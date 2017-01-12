var dgram = require('dgram');
var client = dgram.createSocket('udp6');

const type = 'udp6';
const port = 1337;

client = dgram.createSocket({ type: 'udp6', reuseAddr: true });

client.on('message', function (msg, rinfo) {
  console.log(rinfo);
  msg = msg.toString();
  msg = JSON.parse(msg);
  console.log(msg.r);
  client.close();
});

let msg = {a: 2, e: 1, h: '45F7C21FE88C389DD24D6523678C17C9170648A7'};
msg = JSON.stringify(msg);
msg = new Buffer(msg);

if (type === 'udp4') {
  client.send(msg, 0, msg.length, port, '138.197.92.39', (err) => {
      if (err) { console.log('Error: ', err); }
  });
}

if (type === 'udp6') {
  client.send(msg, 0, msg.length, port, '2604:a880:800:10::2258:6001', (err) => {
      if (err) { console.log('Error: ', err); }
  });
}
