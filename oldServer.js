const server = require('http').createServer()
  , url = require('url')
  , WebSocketServer = require('ws').Server
  , wss = new WebSocketServer({ server: server })
  , express = require('express')
  , dgram = require('dgram')
  , app = express()
  , port = 1337;

const responseTime = require('response-time')
const redis = require('redis');
const _ = require("lodash");

// Without using streams, this can handle ~320 IPv4 addresses. More doesn't necessarily mean better.
const MAX_PEER_SIZE = 75;

// set up the response-time middleware
app.use(responseTime());

//Redis
// var client = redis.createClient('6379', 'redis');
var client = redis.createClient();

// if an error occurs, print it to the console
client.on('error', function (err) {
    console.log("Error " + err);
});
client.on('ready', function() {
  console.log('Redis is up and running.');
});

// Express

app.get('/', function (req, res) {
  res.send('Hello World!');
});

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
  handleMessage(number, hash, EVENT, peerName, null, (reply) => {
    res.send(reply);
  });

});

server.on('request', app);

server.listen(port, function () { console.log('HTTP Express Listening on ' + server.address().port + '.\nWebsocket Listening on ' + server.address().port + '.') });


// WebSocket
wss.on('connection', function connection(ws) {
  let sa = ws._socket.address() //{ port: 8081, family: 2, address: '127.0.0.1' }
  let ra = ws._socket.remoteAddress //'74.125.224.194'
  let rp = ws._socket.remotePort //41435
  console.log('socket address: ', sa);
  console.log('socket remote address: ', ra);
  console.log('socket rp: ', rp);
  var location = url.parse(ws.upgradeReq.url, true);
  var peerName = ws.upgradeReq.headers['x-forwarded-for'] || ws.upgradeReq.connection.remoteAddress;
  if (peerName.substr(0, 7) == "::ffff:") {
    peerName = peerName.substr(7);
  }
  // you might use location.query.access_token to authenticate or share sessions
  // or ws.upgradeReq.headers.cookie (see http://stackoverflow.com/a/16395220/151312)
  ws.on('message', function incoming(msg) {
    msg = JSON.parse(msg);
    handleMessage(msg.a, msg.h, msg.e, peerName, location, (reply) => {
      ws.send(reply);
    });
  });

});


//UDP:
udp4 = dgram.createSocket({ type: 'udp4', reuseAddr: true });
udp4.on('message', function (msg, rinfo) {
  msg = msg.toString();
  msg = JSON.parse(msg);
  handleMessage(msg.a, msg.h, msg.e, rinfo.address, null, (reply) => {
    udp4.send(reply, 0, reply.length, rinfo.port, rinfo.address, (err) => {
      if (err) { console.log('error: ', err)};
    });
  });
});
udp4.on('error', function (err) { console.log('error',err); });
udp4.on('listening', () => { console.log('UDP-4 Bound to 1337.'); } );
udp4.bind(1337);

udp6 = dgram.createSocket({ type: 'udp6', reuseAddr: true });
udp6.on('message', function (msg, rinfo) {
  msg = msg.toString();
  msg = JSON.parse(msg);
  handleMessage(msg.a, msg.h, msg.e, rinfo.address, null, (reply) => {
    udp6.send(reply, 0, reply.length, rinfo.port, rinfo.address, (err) => {
      if (err) { console.log('error: ', err)};
    });
  });
});
udp6.on('error', function (err) { console.log('error',err); });
udp6.on('listening', () => { console.log('UDP-6 Bound to 1337.'); } );
udp6.bind(1337);


// MESSAGE FUNCTIONS:

function handleMessage(action, hash, EVENT, peerName, location, cb) {
  // ACTIONS:
  // 0: CONNECT (BECOME PART OF THE SWARM)
  //   E: 0 - USER HAS FULL FILE
  //   E: 1 - USER HAS PARTIAL FILE
  // 1: ANNOUNCE (NEW HASH)
  // 2: SCRAPE (GET INFO)
  // 3: UDPATE (CHANGED STATE OR STILL ALIVE)
  //   E: 0 - UPDATE USER FROM PARTIAL TO FULL
  //   E: 1 - MOVE TO FRONT OF SWARM TRACKS
  // 4: DISCONNECT (LEAVE THE SWARM)
  //   E: 0 - USER HAS FULL FILE
  //   E: 1 - USER HAS PARTIAL FILE
  let result;
  let eType;
  switch (Number(action)){
    case 0:
      //CONNECT (BECOME PART OF THE SWARM) - uses the event parameter

      //event: 0 - completed; 1 - downloading;
      if (EVENT == 0){
        eType = ':completed';
      } else if (EVENT == 1){
        eType = ':downloading';
      } else {
        result = { r: 'error' };
        result = JSON.stringify(result);
        cb(result);
      }

      client.get(hash + ':peers', (err, reply) => {
        if (err) {
          result = { r: 'error' };
          result = JSON.stringify(result);
          cb(result);
        }
        else {
          let addMe = peerName + ',' + reply;
          addMe = addMe.split(',');
          addMe = _.uniq(addMe);
          if (addMe.length > MAX_PEER_SIZE){
            addMe = addMe.slice(0, MAX_PEER_SIZE);
          }
          addMe = addMe.join(',');
          client.set(hash + ':peers', addMe);
          client.incr(hash + eType);
          result = { r: 'success' };
          result = JSON.stringify(result);
          cb(result);
        }

      });
      break;
    case 1:
      //ANOUNCE (NEW HASH)
      let time = Date.now();
      client.mset(hash + ':lastAccess', time, hash + ':peers', peerName, hash + ':completed', 1, (err) => {
        if (err) {result = {r: 'error'}; }
        else {result = {r: 'saved'} }
        result = JSON.stringify(result);
        cb(result);
      });
      break;
    case 2:
      //SCRAPE (get info)
      client.mget([hash + ':peers', hash + ':downloading', hash + ':completed'], (err, reply) => {
        if (err) { res = {r: 'error'};}
        else {
          result = {r: reply};
          result = JSON.stringify(result);
          cb(result);
        }
      });
      break;
    case 3:
      //UDPATE (change status) - uses the event parameter

      // 0 - now completed; 1 - still downloading;
      if (EVENT == 0) {
        client.decr(hash + ':downloading', (err) => {
          if (err) {
            result = {r: 'error'};
            result = JSON.stringify(result);
            cb(result);
          }
          else {
            client.incr(hash + ':completed');
            client.get(hash + ':peers', (err, reply) => {

              let addMe = peerName + ',' + reply;
              addMe = addMe.split(',');
              addMe = _.uniq(addMe);
              addMe = addMe.join(',');
              client.set(hash + ':peers', addMe);
              client.incr(hash + eType);
              result = { r: reply };
              result = JSON.stringify(result);
              cb(result);

            });
          }
        });
      } else if (EVENT == 1) {
        client.get(hash + ':peers', (err, reply) => {
          if (err) {
            result = { r: 'error' };
            result = JSON.stringify(result);
            cb(result);
          }
          else {
            let addMe = peerName + ',' + reply;
            addMe = addMe.split(',');
            addMe = _.uniq(addMe);
            addMe = addMe.join(',');
            client.set(hash + ':peers', addMe);
            result = { r: reply };
            result = JSON.stringify(result);
            cb(result);
          }

        });
      } else {
        result = {r: 'error'};
        result = JSON.stringify(result);
        cb(result);
      }
      break;
    case 4:
      //DISCONNECT - uses the event parameter

      //event: 0 - completed; 1 - downloading;
      if (EVENT == 0){
        eType = ':completed';
      } else if (EVENT == 1){
        eType = ':downloading';
      } else {
        result = { r: 'error' };
        result = JSON.stringify(result);
        cb(result);
      }
      client.get(hash + ':peers', (err, reply) => {
        if (err) {
          result = { r: 'error' };
          result = JSON.stringify(result);
          cb(result);
        }
        else {
          let removeMe = reply.split(',');
          let index = reply.indexOf(peerName);
          if (index > -1){
            removeMe.splice(index,1);
          }
          removeMe = removeMe.join(',');
          client.set(hash + ':peers', removeMe);
          client.decr(hash + eType);
          result = { r: 'success' };
          result = JSON.stringify(result);
          cb(result);
        }

      });
      break;
    default:
      res = {r: 'error'};
      res = JSON.stringify(res);
      cb(result);
  }
}
