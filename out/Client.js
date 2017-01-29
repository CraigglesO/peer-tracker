"use strict";
const events_1 = require("events");
const buffer_1 = require("buffer");
const dgram = require("dgram");
const debug = require("debug");
debug("trackerClient");
const writeUInt64BE = require("writeUInt64BE"), ACTION_CONNECT = 0, ACTION_ANNOUNCE = 1, ACTION_SCRAPE = 2, ACTION_ERROR = 3;
let connectionIdHigh = 0x417, connectionIdLow = 0x27101980;
class UdpTracker extends events_1.EventEmitter {
    constructor(type, trackerHost, port, myPort, infoHash, left, uploaded, downloaded) {
        super();
        if (!(this instanceof UdpTracker))
            return new UdpTracker(type, trackerHost, port, myPort, infoHash, left, uploaded, downloaded);
        const self = this;
        self.USER = "-EM0012-" + guidvC();
        self.CASE = type;
        self.HOST = trackerHost;
        self.HASH = infoHash;
        self.PORT = port;
        self.MY_PORT = myPort;
        self.TRANSACTION_ID = null;
        self.EVENT = 0;
        self.SCRAPE = true;
        self.LEFT = left;
        self.UPLOADED = uploaded;
        self.DOWNLOADED = downloaded;
        self.KEY = 0;
        self.IP_ADDRESS = 0;
        self.server = dgram.createSocket("udp4");
        self.server.on("listening", function () {
            switch (self.CASE) {
                case "start":
                    self.EVENT = 2;
                    break;
                case "stop":
                    self.EVENT = 3;
                    setTimeout(() => {
                        self.server.close();
                    }, 300);
                    break;
                case "complete":
                    self.EVENT = 1;
                    break;
                case "update":
                    self.EVENT = 0;
                    break;
                case "scrape":
                    self.scrape();
                    self.EVENT = 2;
                    return;
                default:
                    self.emit("error", "Bad call signature.");
                    return;
            }
            self.announce();
        });
        self.server.on("message", function (msg, rinfo) { self.message(msg, rinfo); });
        self.server.bind(self.MY_PORT);
    }
    sendPacket(buf) {
        const self = this;
        self.server.send(buf, 0, buf.length, self.PORT, self.HOST, (err) => {
            if (err) {
                self.emit("error", err);
            }
        });
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
            let buf = new buffer_1.Buffer(36);
            buf.fill(0);
            buf.writeUInt32BE(connectionIdHigh, 0);
            buf.writeUInt32BE(connectionIdLow, 4);
            buf.writeUInt32BE(ACTION_SCRAPE, 8);
            buf.writeUInt32BE(self.TRANSACTION_ID, 12);
            buf.write(self.HASH, 16, 20, "hex");
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
        let buf = new buffer_1.Buffer(msg);
        let action = buf.readUInt32BE(0);
        self.TRANSACTION_ID = buf.readUInt32BE(4);
        if (action === ACTION_CONNECT) {
            connectionIdHigh = buf.readUInt32BE(8);
            connectionIdLow = buf.readUInt32BE(12);
            self.announce();
        }
        else if (action === ACTION_SCRAPE) {
            let seeders = buf.readUInt32BE(8), completed = buf.readUInt32BE(12), leechers = buf.readUInt32BE(16);
            self.emit("scrape", seeders, completed, leechers);
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
exports.UdpTracker = UdpTracker;
class WssTracker extends events_1.EventEmitter {
    constructor() {
        super();
        if (!(this instanceof WssTracker))
            return new WssTracker();
        const self = this;
    }
}
exports.WssTracker = WssTracker;
function guidvC() {
    return Math.floor((1 + Math.random()) * 0x1000000000000)
        .toString(16)
        .substring(1);
}
