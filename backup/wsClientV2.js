var WebSocket = require('ws');
var ws = new WebSocket('ws://0.0.0.0:1337');

ws.on('open', function open() {

  let msg = {a: 2, e: 0, h: '45F7C21FE88C389DD24D6523678C17C9170648A7'};
  msg = JSON.stringify(msg);
  ws.send(msg);

});

ws.on('message', function (payload, flags) {

  payload = JSON.parse(payload);
  console.log(payload.r);
  ws.close();

});
