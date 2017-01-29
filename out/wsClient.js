"use strict";
var WsClient = (function () {
    function WsClient() {
    }
    return WsClient;
}());
var WebSocket = require("ws");
var ws = new WebSocket("ws://0.0.0.0");
ws.on("open", function open() {
    ws.send("something");
});
ws.on("message", function incoming(data, flags) {
});
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = WsClient;
