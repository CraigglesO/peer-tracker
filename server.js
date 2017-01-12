'use strict';
const server                = require('http').createServer()
    , url                   = require('url')
    , WebSocketServer       = require('ws').Server
    , wss                   = new WebSocketServer({ server: server })
    , express               = require('express')
    , dgram                 = require('dgram')
    , udp4                  = dgram.createSocket({ type: 'udp4', reuseAddr: true })
    , app                   = express()
    , buffer                = require('buffer').Buffer
    , readUInt64BE          = require('readUInt64BE')
    , serverPort            = 1337
    , ACTION_CONNECT        = 0
    , ACTION_ANNOUNCE       = 1
    , ACTION_SCRAPE         = 2
    , ACTION_ERROR          = 3
    , INTERVAL              = 1801
    , startConnectionIdHigh = 0x417
    , startConnectionIdLow  = 0x27101980;

const responseTime = require('response-time');
const redis = require('redis');
const _ = require("lodash");

// Without using streams, this can handle ~320 IPv4 addresses. More doesn't necessarily mean better.
const MAX_PEER_SIZE = 50;
const FOUR_AND_FIFTEEN_DAYS = 415 * 24 * 60 * 60;//assuming start time is seconds for redis;

// set up the response-time middleware
app.use(responseTime());

// Redis
var client = redis.createClient();

// If an error occurs, print it to the console
client.on('error', function (err) {
    console.log("Redis error: " + err);
});
client.on('ready', function() {
  console.log('Redis is up and running.');
});

// Express

app.get('/', function (req, res) {
  res.status(202).send('Hello World!');
});

app.get('/stat', function (req,res) {
  res.status(202).send('This will be a stat page..');
});

//Handling an http request:
app.get('/announce/:number/:hash/:EVENT', function (req, res) {

  let peerName = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  if (peerName === '::1'){
    peerName = '127.0.0.1';
  }
  if (peerName.substr(0, 7) == "::ffff:") {
    peerName = peerName.substr(7);
  }
  let number = req.params.number;
  let hash = req.params.hash;
  let EVENT = req.params.EVENT;
  handleMessage(msg, peerAddress, port, (reply) => {
    res.send(reply);
  });

});

app.get('*', function(req, res){
  res.status(404).send('<h1>404 Not Found</h1>');
});

server.on('request', app);

server.listen(serverPort, function () { console.log('HTTP Express Listening on ' + server.address().port + '.\nWebsocket Listening on ' + server.address().port + '.') });


// WebSocket:
wss.on('connection', function connection(ws) {
  //let location = url.parse(ws.upgradeReq.url, true);
  let peerAddress = ws._socket.remoteAddress // '74.125.224.194'
  let port = ws._socket.remotePort // 41435

  ws.on('message', function incoming(msg) {
    handleMessage(msg, peerAddress, port, (reply) => {
      ws.send(reply);
    });
  });

});

//UDP:
udp4.on('message', function (msg, rinfo) {
  handleMessage(msg, rinfo.address, rinfo.port, (reply) => {
    udp4.send(reply, 0, reply.length, rinfo.port, rinfo.address, (err) => {
      if (err) { console.log('udp4 error: ', err)};
    });
  });
});
udp4.on('error', function (err) { console.log('error',err); });
udp4.on('listening', () => { console.log('UDP-4 Bound to 1337.'); } );
udp4.bind(serverPort);


// MESSAGE FUNCTIONS:

function handleMessage(msg, peerAddress, port, cb) {
  // PACKET SIZES:
  // CONNECT: 16 - ANNOUNCE: 98 - SCRAPE: 16 OR (16 + 20 * n)
  let buf              = new Buffer(msg),
      bufLength        = buf.length,
      transaction_id   = 0,
      action           = null,
      connectionIdHigh = null,
      connectionIdLow  = null,
      hash             = null,
      responce         = null;

  // Ensure packet fullfills the minimal 16 byte requirement.
  if (bufLength < 16) {
    ERROR();
  } else {
    // Get generic data:
    connectionIdHigh = buf.readUInt32BE(0),    // 0     64-bit integer  connection_id    0x41727101980
    connectionIdLow  = buf.readUInt32BE(4),    // 0     64-bit integer  connection_id    0x41727101980
    action           = buf.readUInt32BE(8),    // 8     32-bit integer  action           0 // connect 1 // announce 2 // scrape 3 // error
    transaction_id   = buf.readUInt32BE(12);   // 12    32-bit integer  transaction_id
  }

  switch (action){
    case ACTION_CONNECT:
      //Check whether the transaction ID is equal to the one you chose.
      if (startConnectionIdLow !== connectionIdLow || startConnectionIdHigh !== connectionIdHigh) {
        ERROR();
        break;
      }
      // Create a new Connection ID and Transaction ID for this user... kill after 30 seconds:
      let newConnectionIDHigh = ~~((Math.random()*100000)+1);
      let newConnectionIDLow  = ~~((Math.random()*100000)+1);
      client.setex(peerAddress + ':' + newConnectionIDHigh, 30, 1);
      client.setex(peerAddress + ':' + newConnectionIDLow , 30, 1);
      //client.setex(peerAddress + ':' + transaction_id     , 30 * 1000, 1); // THIS MIGHT BE WRONG

      // Create a responce buffer:
      responce = new Buffer(16);
      responce.fill(0);

      responce.writeUInt32BE(ACTION_CONNECT, 0);       // 0       32-bit integer  action          0 // connect
      responce.writeUInt32BE(transaction_id, 4);       // 4       32-bit integer  transaction_id
      responce.writeUInt32BE(newConnectionIDHigh, 8);  // 8       64-bit integer  connection_id
      responce.writeUInt32BE(newConnectionIDLow, 12);   // 8       64-bit integer  connection_id
      cb(responce);
      break;

    case ACTION_ANNOUNCE:
      //Checks to make sure the packet is worth analyzing:
      // 1. packet is atleast 40 bytes
      if (bufLength < 84) {
        ERROR();
        break;
      }
      // FOR NOW WE JUST NEED THIS:
      hash = buf.slice(16,36);
      hash = hash.toString('hex');
      let LEFT     = readUInt64BE(buf, 64),
          EVENT    = buf.readUInt32BE(80),
          peerPort = port,
          peers    = null;

      if (bufLength > 96) {
        peerPort = buf.readUInt16BE(96);
      }
      // 2. check that Transaction ID and Connection ID match
      client.mget([peerAddress + ':' + connectionIdHigh, peerAddress + ':' + connectionIdLow], (err, reply) => {
        if ( !reply[0] || !reply[1] || err ) {
          ERROR();
          return;
        }

        // Check EVENT // 0: none; 1: completed; 2: started; 3: stopped
        // If 1, 2, or 3 do sets first.
        if (EVENT === 1) {
          // Change the array this peer is housed in.
          removePeer(peerAddress+':'+peerPort, hash+':leechers');
          addPeer(peerAddress+':'+peerPort, hash+':seeders');
          // Increment total users who completed file
          client.incr(hash+':completed');
          addHash(hash);
        } else if (EVENT === 2) {
          // Add to array (leecher array if LEFT is > 0)
          if (LEFT > 0)
            addPeer(peerAddress+':'+peerPort, hash+':leechers');
          else
            addPeer(peerAddress+':'+peerPort, hash+':seeders');
          return;
        } else if (EVENT === 3) {
          // Remove peer from array (leecher array if LEFT is > 0)
          if (LEFT > 0)
            removePeer(peerAddress+':'+peerPort, hash+':leechers');
          else
            removePeer(peerAddress+':'+peerPort, hash+':seeders');
          return;
        }

        client.mget([hash+':seeders', hash+':leechers'], (err, rply) => {
          if ( err ) { ERROR(); return; }

          // Convert all addresses to a proper hex buffer:
          // Addresses return: 0 - leechers; 1 - seeders; 2 - hexedUp address-port pairs; 3 - resulting buffersize
          let addresses = addrToBuffer(rply[0], rply[1], LEFT);

          // Create a responce buffer:
          responce = new Buffer(20);
          responce.fill(0);

          responce.writeUInt32BE(ACTION_ANNOUNCE, 0);          // 0           32-bit integer  action          1 // announce
          responce.writeUInt32BE(transaction_id, 4);           // 4           32-bit integer  transaction_id
          responce.writeUInt32BE(INTERVAL, 8);                 // 8           32-bit integer  interval
          responce.writeUInt32BE(addresses[0], 12);            // 12          32-bit integer  leechers
          responce.writeUInt32BE(addresses[1], 16);            // 16          32-bit integer  seeders
          responce = Buffer.concat([responce, addresses[2]]);  // 20 + 6 * n  32-bit integer  IP address
                                                               // 24 + 6 * n  16-bit integer  TCP port
          cb(responce);

        });

      });
      break;

    case ACTION_SCRAPE:
      //Check whether the transaction ID is equal to the one you chose.
      // 2. check that Transaction ID and Connection ID match
      client.incr('scrape');

      // FOR NOW WE JUST NEED THIS:
      hash = buf.slice(16,36);
      hash = hash.toString('hex');

      client.mget([hash+':seeders', hash+':leechers', hash+':completed'], (err, rply) => {
        if ( err ) { ERROR(); return; }

        //convert all addresses to a proper hex buffer:
        let addresses = addrToBuffer(rply[0], rply[1], 1);
        // addresses return: 0 - leechers; 1 - seeders; 2 - hexedUp address-port pairs; 3 - resulting buffersize
        // Create a responce buffer:
        responce = new Buffer(20);
        responce.fill(0);

        responce.writeUInt32BE(ACTION_SCRAPE, 0);  // 0           32-bit integer  action          1 // announce
        responce.writeUInt32BE(transaction_id, 4);   // 4           32-bit integer  transaction_id
        responce.writeUInt32BE(addresses[1], 8);     // 8 + 12 * n  32-bit integer  seeders
        responce.writeUInt32BE(rply[2], 12);         // 12 + 12 * n 32-bit integer  completed
        responce.writeUInt32BE(addresses[0], 16);    // 16 + 12 * n 32-bit integer  leechers
        cb(responce);
      });
      break;

    default:
      ERROR()
  }

  function ERROR() {
    responce = new buffer(11);
    responce.fill(0);

    responce.writeUInt32BE(ACTION_ERROR, 0);
    responce.writeUInt32BE(transaction_id, 4);
    responce.write('900', 8);
    cb(responce);
  }

  function addPeer(peer, where) {
    client.get(where, (err, reply) => {
      if (err) { return; }
      else {
        if (!reply)
          reply = peer;
        else
          reply = peer + ',' + reply;
        reply = reply.split(',');
        reply = _.uniq(reply);
        // Keep the list under 50;
        if (reply.length > 50) {
          reply = reply.slice(0,50);
        }
        reply = reply.join(',');
        client.set(where, reply);
      }
    });
  }

  function removePeer(peer, where) {
    client.get(where, (err, reply) => {
      if (err) { return; }
      else {
        reply = reply.split(',');
        let index = reply.indexOf(peer);
        if (index > 0) {
          reply.splice(index, 1);
        }
        reply = reply.join(',');
        client.set(where, reply);
      }
    });
  }

  function addrToBuffer(seeders, leechers, LEFT) {
    // Addresses return: 0 - leechers; 1 - seeders; 2 - hexedUp address-port pairs; 3 - resulting buffersize
    // Also we don't need to send the users own address
    // If peer is a leecher, send more seeders; if peer is a seeder, send only leechers
    let leecherCount   = 0,
        seederCount    = 0,
        peerBuffer     = null,
        peerBufferSize = 0;

    if (LEFT == 0 || !seeders || seeders == '')
      seeders = new Buffer(0);
    else {
      seeders = seeders.split(',');
      seederCount = seeders.length;
      seeders = seeders.map((addressPort) => {
        let addr = addressPort.split(':')[0];
        let port = addressPort.split(':')[1];
        addr = addr.split('.');
        let b = new Buffer(6);
        b.fill(0);
        b.writeUInt8(addr[0], 0);
        b.writeUInt8(addr[1], 1);
        b.writeUInt8(addr[2], 2);
        b.writeUInt8(addr[3], 3);
        b.writeUInt16BE(port, 4);
        return b;
      });
      seeders = Buffer.concat(seeders);
    }

    if (LEFT > 0 && seederCount > 30 && leechers > 5)
        leechers = leechers.slice(0,5);
    if (!leechers || leechers == '')
      leechers = new Buffer(0);
    else {
      leechers = leechers.split(',');
      leecherCount = leechers.length;
      leechers = leechers.map((addressPort) => {
        let addr = addressPort.split(':')[0];
        let port = addressPort.split(':')[1];
        addr = addr.split('.');
        let b = new Buffer(6);
        b.fill(0);
        b.writeUInt8(addr[0], 0);
        b.writeUInt8(addr[1], 1);
        b.writeUInt8(addr[2], 2);
        b.writeUInt8(addr[3], 3);
        b.writeUInt16BE(port, 4);
        return b;
      });
      leechers = Buffer.concat(leechers);
    }

    peerBuffer = Buffer.concat([seeders, leechers]);
    // Addresses return: 0 - leechers; 1 - seeders; 2 - hexedUp address-port pairs; 3 - resulting buffersize
    return [leecherCount, seederCount, peerBuffer];
  }

  //Add a new hash to the swarm, ensure uniqeness
  function addHash(hash) {
    client.get('hashes', (err, reply) {
      if (err) { return; }
      if (!reply)
        reply = hash;
      else
        reply = hash + ',' + reply;
      reply = _.uniq(reply);
      client.set('hashes', reply);
      client.set(hash+':time', Date.now());
    });
  }

  function getHashes() {
    let r = client.get('hashes', (err, reply) {
      if (err) { return null; }
      reply = reply.split(',');
      return reply;
    });
    return r;
  }

  function updateStatus() {
    // Get hashes -> iterate through hashes and get all peers and leechers
    // Also get number of scrapes 'scrape'
    // Number of active hashes hash+':time'
  }
}


// KEEP TRACK OF HOW MANY HASH KEYS THERE ARE
