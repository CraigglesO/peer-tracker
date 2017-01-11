var dgram = require('dgram');
var client = dgram.createSocket('udp6');

const type = 'udp6';
const port = 1337;
const host = '0.0.0.0';

client = dgram.createSocket({ type: 'udp6', reuseAddr: true });

client.on('message', function (msg, rinfo) {
  msg = msg.toString();
  msg = JSON.parse(msg);
  console.log(msg);
  client.close();
});

let msg = {a: 2, e: 1, h: '45F7C21FE88C389DD24D6523678C17C9170648A7'};
msg = JSON.stringify(msg);
msg = new Buffer(msg);

if (type === 'udp4') {
  client.send(msg, 0, msg.length, port, host, (err) => {
      if (err) { console.log('Error: ', err); }
  });
}

if (type === 'udp6') {
  client.send(msg, 0, msg.length, port, '::1', (err) => {
      if (err) { console.log('Error: ', err); }
  });
}
