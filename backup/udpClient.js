const EventEmitter = require('events').EventEmitter;
const inherits = require('inherits');
var dgram = require('dgram');
var client = dgram.createSocket('udp4');



inherits(udpClient, EventEmitter);

function udpClient(port, host, hash) {
  const that = this;
  EventEmitter.call(this);

  this.port = port;
  this.host = host;
  this.hash = hash;
  this.client = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  this.client.on('message', function (msg, rinfo) {
    msg = msg.toString();
    msg = JSON.parse(msg);
    that.emit('message', msg);
  });

  this.client.bind(1337);
}

udpClient.prototype.announce = function(action, payload) {
  var that = this;

  var message = {
    h: this.hash,
    a: action,
    p: payload,
  }
  message = JSON.stringify(message);
  message = new Buffer(message);

  this.client.send(message, 0, message.length, this.port, this.host, function(err, bytes) {
      if (err) throw err;
  });
}


module.exports = udpClient;

// exports.ACTIONS = { CONNECT: 0, ANNOUNCE: 1, SCRAPE: 2, ERROR: 3 }
// exports.EVENTS = { update: 0, completed: 1, started: 2, stopped: 3 }
