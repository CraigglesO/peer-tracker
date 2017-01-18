'use strict';
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var events_1 = require("events");
var dgram = require("dgram");
var writeUInt64BE = require('writeUInt64BE'), ACTION_CONNECT = 0, ACTION_ANNOUNCE = 1, ACTION_SCRAPE = 2, ACTION_ERROR = 3, connectionIdHigh = 0x417, connectionIdLow = 0x27101980;
var udpTracker = (function (_super) {
    __extends(udpTracker, _super);
    function udpTracker(trackerHost, port, myPort, infoHash) {
        var _this = _super.call(this) || this;
        var self = _this;
        self.HOST = trackerHost;
        self.HASH = infoHash;
        self.PORT = port;
        self.MY_PORT = myPort;
        self.TRANSACTION_ID = null;
        self.EVENT = 0;
        self.SCRAPE = true;
        self.DOWNLOADED = 0;
        self.LEFT = 1;
        self.UPLOADED = 0;
        self.KEY = 0;
        self.IP_ADDRESS = 0;
        self.TIMEOUTS = [];
        self.TIMEOUTS_DATE = 0;
        self.TIMEOUT_N = 1;
        self.server = dgram.createSocket('udp4');
        self.server.on('listening', function () {
            self.scrape();
        });
        self.server.on('message', function (msg, rinfo) { self.message(msg, rinfo); });
        self.server.bind(self.MY_PORT);
        return _this;
    }
    udpTracker.prototype.sendPacket = function (buf) {
        var self = this;
        self.server.send(buf, 0, buf.length, self.PORT, self.HOST, function (err) {
            if (err) {
                self.emit('error', err);
            }
        });
    };
    udpTracker.prototype.startConnection = function () {
        var self = this;
        self.TRANSACTION_ID = ~~((Math.random() * 100000) + 1);
        self.TIMEOUTS.push(setTimeout(function () {
            self.TRANSACTION_ID = null;
            self.SCRAPE = true;
            self.scrape();
        }, self.updateTimer() * 60 * 1000));
        self.TIMEOUTS_DATE = Date.now();
        var buf = new Buffer(16);
        buf.fill(0);
        buf.writeUInt32BE(connectionIdHigh, 0);
        buf.writeUInt32BE(connectionIdLow, 4);
        buf.writeUInt32BE(ACTION_CONNECT, 8);
        buf.writeUInt32BE(self.TRANSACTION_ID, 12);
        self.sendPacket(buf);
    };
    udpTracker.prototype.scrape = function () {
        var self = this;
        if (!self.TRANSACTION_ID) {
            self.startConnection();
        }
        else {
            var buf = new Buffer(36);
            buf.fill(0);
            buf.writeUInt32BE(connectionIdHigh, 0);
            buf.writeUInt32BE(connectionIdLow, 4);
            buf.writeUInt32BE(ACTION_SCRAPE, 8);
            buf.writeUInt32BE(self.TRANSACTION_ID, 12);
            buf.write(self.HASH, 16, 20, 'hex');
            self.sendPacket(buf);
        }
    };
    udpTracker.prototype.announce = function () {
        var self = this;
        if (!self.TRANSACTION_ID) {
            self.startConnection();
        }
        else {
            var buf = new Buffer(98);
            buf.fill(0);
            buf.writeUInt32BE(connectionIdHigh, 0);
            buf.writeUInt32BE(connectionIdLow, 4);
            buf.writeUInt32BE(ACTION_ANNOUNCE, 8);
            buf.writeUInt32BE(self.TRANSACTION_ID, 12);
            buf.write(self.HASH, 16, 20, 'hex');
            buf.write('empire', 36, 20);
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
        }
    };
    udpTracker.prototype.message = function (msg, rinfo) {
        var self = this;
        var buf = new Buffer(msg);
        var action = buf.readUInt32BE(0);
        self.TRANSACTION_ID = buf.readUInt32BE(4);
        if (action === ACTION_CONNECT) {
            var connectionIdHigh_1 = buf.readUInt32BE(8), connectionIdLow_1 = buf.readUInt32BE(12);
            if (self.SCRAPE) {
                self.SCRAPE = false;
                self.scrape();
            }
            else {
                self.announce();
            }
        }
        else if (action === ACTION_SCRAPE) {
            var seeders = buf.readUInt32BE(8), completed = buf.readUInt32BE(12), leechers = buf.readUInt32BE(16);
            self.emit('scrape', seeders, completed, leechers, self.timeTillNextScrape());
            self.announce();
        }
        else if (action === ACTION_ANNOUNCE) {
            var interval = buf.readUInt32BE(8), leechers = buf.readUInt32BE(12), seeders = buf.readUInt32BE(16), bufLength = buf.length, addresses = [];
            for (var i = 20; i < bufLength; i += 6) {
                var address = buf.readUInt8(i) + "." + buf.readUInt8(i + 1) + "." + buf.readUInt8(i + 2) + "." + buf.readUInt8(i + 3) + ":" + buf.readUInt16BE(i + 4);
                addresses.push(address);
            }
            self.emit('announce', interval, leechers, seeders, addresses);
            self.EVENT = 0;
        }
        else if (action === ACTION_ERROR) {
            var errorResponce = buf.slice(8).toString();
            self.emit('error', errorResponce);
        }
    };
    udpTracker.prototype.completed = function () {
        var self = this;
        self.EVENT = 1;
        self.announce();
    };
    udpTracker.prototype.started = function () {
        var self = this;
        self.EVENT = 2;
        self.announce();
    };
    udpTracker.prototype.stopped = function () {
        var self = this;
        self.EVENT = 3;
        self.announce();
    };
    udpTracker.prototype.timeTillNextScrape = function () {
        var self = this;
        return Math.ceil((self.TIMEOUTS_DATE + self.TIMEOUTS[0]._idleTimeout - Date.now()) / 1000);
    };
    udpTracker.prototype.updateTimer = function () {
        var self = this;
        for (var i = 0; i < self.TIMEOUTS.length; i++) {
            clearTimeout(self.TIMEOUTS[i]);
        }
        self.TIMEOUTS.shift();
        if (self.TIMEOUT_N === 1) {
            self.TIMEOUT_N = 5;
            return 5;
        }
        else if (self.TIMEOUT_N <= 5) {
            self.TIMEOUT_N = 10;
            return 10;
        }
        else if (self.TIMEOUT_N <= 15) {
            self.TIMEOUT_N = 20;
            return 20;
        }
        else {
            self.TIMEOUT_N = 30;
            return 30;
        }
    };
    return udpTracker;
}(events_1.EventEmitter));
exports.udpTracker = udpTracker;
var wssTracker = (function (_super) {
    __extends(wssTracker, _super);
    function wssTracker() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return wssTracker;
}(events_1.EventEmitter));
exports.wssTracker = wssTracker;
