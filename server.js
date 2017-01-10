
//Node modules:
const EventEmitter = require('events').EventEmitter;
const inherits = require('inherits');
const Buffer = require('buffer').Buffer;

//Useful modules:
const peerID = require('bittorrent-peerid');

//server modules:
const dgram = require('dgram');
const http = require('http');
const WebSocketServer = require('ws').Server

//MONGODB Store:
const mongoose = require('mongoose');
const MongoDBClient = require('./MongoDB/MongoDBClient');
mongoose.connect('mongodb://localhost/peerTracker');

//const DBClient = new MongoDBClient();
// DBClient.create('1234567890', 'name', '127.0.0.1:8000');
//DBClient.update('1234567890', {incomplete: true, peer: '72.56.34.12:3001'});
// MongoDBClient.find('1234567890', (data) => {
//   console.log(data);
// });

inherits(TServer, EventEmitter);

function TServer (opts) {
  const that = this;
  if (!(this instanceof TServer)) return new TServer(opts);
  EventEmitter.call(this);

  if (!opts) opts = {};

  this.intervalMs = (opts.interval)
    ? opts.interval
    : 10 * 60 * 1000; // 10 min

  this.trackerNumber = 3;
  this.listening = false;
  this.destroyed = false;
  this.torrents = {};

  this.udp4 = null;
  this.udp6 = null;
  this.http = null;
  this.ws = null;

  // start a http tracker
  if (opts.http !== false) {
    console.log('creating http sockets...');
    this.http = http.createServer();
    this.http.on('error', function (err) { this.emit('error',err); });
    this.http.on('listening', trackerListening);

    // Add default http request handler on next tick to give user the chance to add
    // their own handler first. Handle requests untouched by user's handler.
    // process.nextTick(function () {
    //   this.http.on('request', function (req, res) {
    //     if (res.headersSent) return
    //     this.onHttpRequest(req, res)
    //   });
    // });
  }

  // start a udp tracker
  if (opts.udp !== false) {
    console.log('creating udp sockets...');

    this.udp4 = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    this.udp4.on('message', function (msg, rinfo) { that.udpMessage(msg, rinfo) });
    this.udp4.on('error', function (err) { this.emit('error',err); });
    this.udp4.on('listening', trackerListening);
    //this.udp4.on('close', this.emit('udp4 closed'));

    this.udp6 = dgram.createSocket({ type: 'udp6', reuseAddr: true });
    this.udp6.on('message', function (msg, rinfo) { that.udpMessage(msg, rinfo) });
    this.udp6.on('error', function (err) { this.emit('error',err); });
    this.udp6.on('listening', trackerListening);
    //this.udp4.on('close', this.emit('udp6 closed'));
  }

  // start a websocket tracker
  if (opts.ws !== false) {
    if (!this.http) {
      this.http = http.createServer()
      this.http.on('error', function (err) { this._onError(err) })
      this.http.on('listening', onListening)

      // Add default http request handler on next tick to give user the chance to add
      // their own handler first. Handle requests untouched by user's handler.
      process.nextTick(function () {
        this.http.on('request', function (req, res) {
          if (res.headersSent) return
          // For websocket trackers, we only need to handle the UPGRADE http method.
          // Return 404 for all other request types.
          res.statusCode = 404
          res.end('404 Not Found')
        })
      })
    }
    this.ws = new WebSocketServer({ server: this.http })
    this.ws.address = function () {
      return this.http.address()
    }
    this.ws.on('error', function (err) { this.emit('error',err); })
    this.ws.on('connection', function (socket) { this.onWebSocketConnection(socket) })
  }

  function trackerListening() {
    this.trackerNumber--;
    if (this.trackerNumber === 0){
      this.listening = true;
      console.log('all systems are go');
      this.emit('listening');
    }
  }

}

TServer.prototype.udpMessage = function(msg, rinfo) {
  // msg <Buffer> - The message
  // rinfo <Object> - Remote address information
  //   address <String> The sender address
  //   family <String> The address family ('IPv4' or 'IPv6')
  //   port <Number> The sender port
  //   size <Number> The message size

  //console.log(rinfo.address + ':' + rinfo.port +' - ' + msg);
  msg = msg.toString();
  msg = JSON.parse(msg);
  if (msg.a === 1){
    console.log(msg.p);
    MongoDBClient.create(msg.h, msg.p.n, `${rinfo.address}:${rinfo.port}`);
    MongoDBClient.find(msg.h, (data) => {
      let rtrn = {
        n: data.name,
        c: data.complete,
        i: data.incomplete,
        l: data.lastAccess,
        p: data.peers
      }
      rtrn = JSON.stringify(rtrn);
      rtrn = new Buffer(rtrn);
      if (rinfo.family === 'IPv4') {
        this.udp4.send(rtrn, 0, rtrn.length, rinfo.port, rinfo.address, function(err, bytes) {
            if (err) throw err;
        });
      }
      if (rinfo.family === 'IPv6') {
        this.udp6.send(rtrn, 0, rtrn.length, rinfo.port, rinfo.address, function(err, bytes) {
            if (err) throw err;
        });
      }
    });
  }
  if (msg.a === 2){
    MongoDBClient.find(msg.h, (data) => {
      let rtrn = {
        n: data.name,
        c: data.complete,
        i: data.incomplete,
        l: data.lastAccess,
        p: data.peers
      }
      rtrn = JSON.stringify(rtrn);
      rtrn = new Buffer(rtrn);
      if (rinfo.family === 'IPv4') {
        this.udp4.send(rtrn, 0, rtrn.length, rinfo.port, rinfo.address, function(err, bytes) {
            if (err) throw err;
        });
      }
      if (rinfo.family === 'IPv6') {
        this.udp6.send(rtrn, 0, rtrn.length, rinfo.port, rinfo.address, function(err, bytes) {
            if (err) throw err;
        });
      }
    });
  }
}

TServer.prototype.listen = function(port, hostname){
  if (this.http) this.http.listen(port, hostname);
  if (this.udp4) this.udp4.bind(port, hostname);
  if (this.udp6) this.udp6.bind(port, hostname);
}

TServer.prototype.httpRequest = function(port, hostname){
  if (this.http) this.http.listen(port, hostname);
  if (this.udp4) this.udp4.bind(port, hostname);
  if (this.udp6) this.udp6.bind(port, hostname);
}


var Serve = new TServer({
  udp: true,
  http: true,
  ws: true,
  stats: true,
});

// start tracker server listening! Use 0 to listen on a random free port.
Serve.listen(8000);
