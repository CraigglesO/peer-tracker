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

// a - action:
//  1 - announce
//  2 - scrape
//  3 - new torrent file
//  4 - new peer (incomplete) - get peers
//  5 - complete
//  6 - leaving
// h - hash:
//
