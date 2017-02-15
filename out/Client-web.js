"use strict";
const events_1 = require("events");
const writeUInt64BE = require("writeuint64be");
const WebSocket = require("ws");
const buffer_1 = require("buffer");
const debug = require("debug")("PeerTracker:Client"), ACTION_CONNECT = 0, ACTION_ANNOUNCE = 1, ACTION_SCRAPE = 2, ACTION_ERROR = 3;
let connectionIdHigh = 0x417, connectionIdLow = 0x27101980;
function ws(announcement, trackerHost, port, myPort, infoHash, left, uploaded, downloaded) {
    return new ClientWeb("ws", announcement, trackerHost, port, myPort, infoHash, left, uploaded, downloaded);
}
exports.ws = ws;
class ClientWeb extends events_1.EventEmitter {
    constructor(type, announcement, trackerHost, port, myPort, infoHash, left, uploaded, downloaded) {
        super();
        this._debug = (...args) => {
            args[0] = "[" + this._debugId + "] " + args[0];
            debug.apply(null, args);
        };
        if (!(this instanceof ClientWeb))
            return new ClientWeb(type, announcement, trackerHost, port, myPort, infoHash, left, uploaded, downloaded);
        const self = this;
        self._debugId = ~~((Math.random() * 100000) + 1);
        self._debug("peer-tracker Server instance created");
        self.TYPE = type;
        self.USER = "-EM0012-" + guidvC();
        self.CASE = announcement;
        self.HOST = trackerHost;
        self.HASH = (Array.isArray(infoHash)) ? infoHash.join("") : infoHash;
        self.PORT = port;
        self.MY_PORT = myPort;
        self.TRANSACTION_ID = null;
        self.EVENT = 0;
        self.LEFT = left;
        self.UPLOADED = uploaded;
        self.DOWNLOADED = downloaded;
        self.KEY = 0;
        self.IP_ADDRESS = 0;
        self.SCRAPE = false;
        self.HOST = "ws://" + self.HOST + ":" + self.PORT;
        self.server = new WebSocket(self.HOST);
        self.server.on("open", function () {
            self.prepAnnounce();
        });
        self.server.on("message", function (msg, flags) { self.message(msg, flags); });
    }
    prepAnnounce() {
        const self = this;
        switch (self.CASE) {
            case "start":
                self.EVENT = 2;
                break;
            case "stop":
                self.EVENT = 3;
                setTimeout(() => {
                    self.server.close();
                }, 1500);
                break;
            case "complete":
                self.EVENT = 1;
                break;
            case "update":
                self.EVENT = 0;
                break;
            case "scrape":
                self.SCRAPE = true;
                self.EVENT = 2;
                self.scrape();
                return;
            default:
                self.emit("error", "Bad call signature.");
                return;
        }
        self.announce();
    }
    sendPacket(buf) {
        const self = this;
        if (self.TYPE === "udp") {
            self.server.send(buf, 0, buf.length, self.PORT, self.HOST, (err) => {
                if (err) {
                    self.emit("error", err);
                }
            });
        }
        else {
            self.server.send(buf);
        }
    }
    startConnection() {
        const self = this;
        self.TRANSACTION_ID = ~~((Math.random() * 100000) + 1);
        let buf = new buffer_1.Buffer(16);
        buf.fill(0);
        buf.writeUInt32BE(connectionIdHigh, 0);
        buf.writeUInt32BE(connectionIdLow, 4);
        buf.writeUInt32BE(ACTION_CONNECT, 8);
        buf.writeUInt32BE(self.TRANSACTION_ID, 12);
        self.sendPacket(buf);
    }
    scrape() {
        const self = this;
        if (!self.TRANSACTION_ID) {
            self.startConnection();
        }
        else {
            let hashBuf = buffer_1.Buffer.from(self.HASH, "hex");
            let buf = new buffer_1.Buffer(16);
            buf.fill(0);
            buf.writeUInt32BE(connectionIdHigh, 0);
            buf.writeUInt32BE(connectionIdLow, 4);
            buf.writeUInt32BE(ACTION_SCRAPE, 8);
            buf.writeUInt32BE(self.TRANSACTION_ID, 12);
            buf = buffer_1.Buffer.concat([buf, hashBuf]);
            self.sendPacket(buf);
        }
    }
    announce() {
        const self = this;
        if (!self.TRANSACTION_ID) {
            self.startConnection();
        }
        else {
            let buf = new buffer_1.Buffer(98);
            buf.fill(0);
            buf.writeUInt32BE(connectionIdHigh, 0);
            buf.writeUInt32BE(connectionIdLow, 4);
            buf.writeUInt32BE(ACTION_ANNOUNCE, 8);
            buf.writeUInt32BE(self.TRANSACTION_ID, 12);
            buf.write(self.HASH, 16, 20, "hex");
            buf.write(self.USER, 36, 20);
            writeUInt64BE(buf, self.DOWNLOADED, 56);
            writeUInt64BE(buf, self.LEFT, 64);
            writeUInt64BE(buf, self.UPLOADED, 72);
            buf.writeUInt32BE(self.EVENT, 80);
            buf.writeUInt32BE(self.IP_ADDRESS, 84);
            buf.writeUInt32BE(self.KEY, 88);
            buf.writeInt32BE((-1), 92);
            buf.writeUInt16BE(self.MY_PORT, 96);
            self.sendPacket(buf);
            self.TRANSACTION_ID = null;
            connectionIdHigh = 0x417,
                connectionIdLow = 0x27101980;
        }
    }
    message(msg, rinfo) {
        const self = this;
        let buf;
        if (!buffer_1.Buffer.isBuffer(msg))
            buf = new buffer_1.Buffer(msg);
        else
            buf = msg;
        let action = buf.readUInt32BE(0);
        self.TRANSACTION_ID = buf.readUInt32BE(4);
        if (action === ACTION_CONNECT) {
            connectionIdHigh = buf.readUInt32BE(8);
            connectionIdLow = buf.readUInt32BE(12);
            if (self.SCRAPE)
                self.scrape();
            else
                self.announce();
        }
        else if (action === ACTION_SCRAPE) {
            for (let i = 0; i < (buf.length - 8); i += 20) {
                let seeders = buf.readUInt32BE(8 + i), completed = buf.readUInt32BE(12 + i), leechers = buf.readUInt32BE(16 + i);
                self.emit("scrape", seeders, completed, leechers);
            }
            self.announce();
        }
        else if (action === ACTION_ANNOUNCE) {
            let interval = buf.readUInt32BE(8), leechers = buf.readUInt32BE(12), seeders = buf.readUInt32BE(16), bufLength = buf.length, addresses = [];
            for (let i = 20; i < bufLength; i += 6) {
                let address = `${buf.readUInt8(i)}.${buf.readUInt8(i + 1)}.${buf.readUInt8(i + 2)}.${buf.readUInt8(i + 3)}:${buf.readUInt16BE(i + 4)}`;
                addresses.push(address);
            }
            self.emit("announce", interval, leechers, seeders, addresses);
            self.server.close();
        }
        else if (action === ACTION_ERROR) {
            let errorResponce = buf.slice(8).toString();
            self.emit("error", errorResponce);
            self.server.close();
        }
    }
}
function guidvC() {
    return Math.floor((1 + Math.random()) * 0x1000000000000)
        .toString(16)
        .substring(1);
}
