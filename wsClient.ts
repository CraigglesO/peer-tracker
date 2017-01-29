"use strict";

class WsClient {
  constructor() {

  }
}

const WebSocket = require("ws");

const ws = new WebSocket("ws://0.0.0.0");

ws.on("open", function open() {
  ws.send("something");
});

ws.on("message", function incoming(data, flags) {
  // flags.binary will be set if a binary data is received.
  // flags.masked will be set if the data was masked.
});


export default WsClient;
