"use strict";
const http_1 = require("http");
const WebSocketServer = require("ws");
const express = require("express");
const dgram = require("dgram");
const readUInt64BE = require("readUInt64BE");
const buffer_1 = require("buffer");
const _ = require("lodash");
const debug = require("debug");
debug("PeerTracker:Server");
process.on("uncaughtException", function (err) {
    console.log(err);
});
const redis = require("redis");
const GeoIpNativeLite = require("geoip-native-lite");
const bencode = require("bencode");
GeoIpNativeLite.loadDataSync();
let stats = {
    seedCount: 0,
    leechCount: 0,
    torrentCount: 0,
    activeTcount: 0,
    scrapeCount: "",
    successfulDown: 0,
    countries: {}
};
const ACTION_CONNECT = 0, ACTION_ANNOUNCE = 1, ACTION_SCRAPE = 2, ACTION_ERROR = 3, INTERVAL = 1801, startConnectionIdHigh = 0x417, startConnectionIdLow = 0x27101980;
const MAX_PEER_SIZE = 1500;
const FOUR_AND_FIFTEEN_DAYS = 415 * 24 * 60 * 60;
let client;
class Server {
    constructor(opts) {
        const self = this;
        if (!opts)
            opts = { port: 80, udpPort: 1337, docker: false };
        self.PORT = opts.port;
        self.udpPORT = opts.udpPort;
        self.server = http_1.createServer();
        self.wss = new WebSocketServer.Server({ server: self.server });
        self.udp4 = dgram.createSocket({ type: "udp4", reuseAddr: true });
        self.app = express();
        if (opts.docker)
            client = redis.createClient('6379', 'redis');
        else
            client = redis.createClient();
        client.on("error", function (err) {
            console.log("Redis error: " + err);
        });
        client.on("ready", function () {
            console.log("Redis is up and running.");
        });
        self.app.get("/", function (req, res) {
            res.status(202).send("Welcome to the Empire.");
        });
        self.app.get("/stat.json", function (req, res) {
            res.status(202).send(stats);
        });
        self.app.get("/stat", function (req, res) {
            let parsedResponce = `<h1>${stats.torrentCount} Torrents {${stats.activeTcount} active}</h1>\n
                            <h2>Successful Downloads: ${stats.successfulDown}</h2>\n
                            <h2>Number of Scrapes to this tracker: ${stats.scrapeCount}</h2>\n
                            <h3>Connected Peers: ${stats.seedCount + stats.leechCount}</h3>\n
                            <h3><ul>Seeders: ${stats.seedCount}</ul></h3>\n
                            <h3><ul>Leechers: ${stats.leechCount}</ul></h3>\n
                            <h3>Countries that have connected: <h3>\n
                            <ul>`;
            let countries;
            for (countries in stats.countries)
                parsedResponce += `<li>${stats.countries[countries]}</li>\n`;
            parsedResponce += "</ul>";
            res.status(202).send(parsedResponce);
        });
        self.app.get("*", function (req, res) {
            res.status(404).send("<h1>404 Not Found</h1>");
        });
        self.server.on("request", self.app.bind(self));
        self.server.listen(self.PORT, function () { console.log("HTTP Express Listening on " + self.server.address().port + ",\nWebsocket Listening on " + self.server.address().port + "."); });
        self.wss.on("connection", function connection(ws) {
            console.log("incoming WS...");
            let peerAddress = ws._socket.remoteAddress;
            let port = ws._socket.remotePort;
            ws.on("message", function incoming(msg) {
                handleMessage(msg, peerAddress, port, (reply) => {
                    console.log("sending reply");
                    ws.send(reply);
                });
            });
        });
        self.udp4.on("message", function (msg, rinfo) {
            console.log("incoming...");
            handleMessage(msg, rinfo.address, rinfo.port, (reply) => {
                self.udp4.send(reply, 0, reply.length, rinfo.port, rinfo.address, (err) => {
                    if (err) {
                        console.log("udp4 error: ", err);
                    }
                    ;
                    console.log("sent to: ", rinfo.address, " port: ", rinfo.port);
                });
            });
        });
        self.udp4.on("error", function (err) { console.log("error", err); });
        self.udp4.on("listening", () => { console.log("UDP-4 Bound to 1337."); });
        self.udp4.bind(udpServerPort);
        self.updateStatus((info) => {
            stats = info;
        });
        setInterval(() => {
            console.log(Date.now());
            self.updateStatus((info) => {
                stats = info;
            });
        }, 30 * 60 * 1000);
    }
    updateStatus(cb) {
        const self = this;
        let NOW = Date.now(), seedCount = 0, leechCount = 0, torrentCount = 0, activeTcount = 0, scrapeCount = 0, successfulDown = 0, countries = {};
        client.get("hashes", (err, reply) => {
            if (!reply)
                return;
            let hashList = reply.split(",");
            torrentCount = hashList.length;
            hashList.forEach((hash, i) => {
                client.mget([hash + ":seeders", hash + ":leechers", hash + ":time", hash + ":completed"], (err, rply) => {
                    if (err) {
                        return;
                    }
                    if (rply[0]) {
                        rply[0] = rply[0].split(",");
                        seedCount += rply[0].length;
                        rply[0].forEach((addr) => {
                            let ip = addr.split(":")[0];
                            let country = GeoIpNativeLite.lookup(ip);
                            if (country)
                                countries[country] = country.toUpperCase();
                        });
                    }
                    if (rply[1]) {
                        rply[1] = rply[1].split(",");
                        seedCount += rply[1].length;
                        rply[1].forEach((addr) => {
                            let ip = addr.split(":")[0];
                            let country = GeoIpNativeLite.lookup(ip);
                            if (country)
                                countries[country] = country.toUpperCase();
                        });
                    }
                    if (rply[2]) {
                        if (((NOW - rply[2]) / 1000) < 432000)
                            activeTcount++;
                    }
                    if (rply[3]) {
                        successfulDown += Number(rply[3]);
                    }
                    if (i === (torrentCount - 1)) {
                        cb({ seedCount, leechCount, torrentCount, activeTcount, scrapeCount, successfulDown, countries });
                    }
                });
            });
        });
        client.get("scrape", (err, rply) => {
            if (err) {
                return;
            }
            if (!rply)
                return;
            stats.scrapeCount = rply;
        });
    }
}
function handleMessage(msg, peerAddress, port, cb) {
    console.log("connection occured... address: " + peerAddress + " and port: " + port);
    let buf = new buffer_1.Buffer(msg), bufLength = buf.length, transaction_id = 0, action = null, connectionIdHigh = null, connectionIdLow = null, hash = null, responce = null, PEER_ID = null, PEER_ADDRESS = null, PEER_KEY = null, NUM_WANT = null, peerPort = port, peers = null;
    if (bufLength < 16) {
        ERROR();
    }
    else {
        connectionIdHigh = buf.readUInt32BE(0),
            connectionIdLow = buf.readUInt32BE(4),
            action = buf.readUInt32BE(8),
            transaction_id = buf.readUInt32BE(12);
    }
    console.log("buffer: ", buf.toString("hex"));
    console.log("connectionIdHigh: ", connectionIdHigh);
    console.log("connectionIdLow: ", connectionIdLow);
    console.log("action: ", action);
    console.log("transaction_id: ", transaction_id);
    switch (action) {
        case ACTION_CONNECT:
            console.log("connect request: ");
            if (startConnectionIdLow !== connectionIdLow || startConnectionIdHigh !== connectionIdHigh) {
                ERROR();
                break;
            }
            let newConnectionIDHigh = ~~((Math.random() * 100000) + 1);
            let newConnectionIDLow = ~~((Math.random() * 100000) + 1);
            client.setex(peerAddress + ":" + newConnectionIDHigh, 60, 1);
            client.setex(peerAddress + ":" + newConnectionIDLow, 60, 1);
            client.setex(peerAddress + ":" + startConnectionIdLow, 60, 1);
            client.setex(peerAddress + ":" + startConnectionIdHigh, 60, 1);
            responce = new buffer_1.Buffer(16);
            responce.fill(0);
            responce.writeUInt32BE(ACTION_CONNECT, 0);
            responce.writeUInt32BE(transaction_id, 4);
            responce.writeUInt32BE(newConnectionIDHigh, 8);
            responce.writeUInt32BE(newConnectionIDLow, 12);
            console.log("send connection packet back...");
            cb(responce);
            break;
        case ACTION_ANNOUNCE:
            console.log();
            console.log("action request made..");
            if (bufLength < 84) {
                ERROR();
                break;
            }
            hash = buf.slice(16, 36);
            hash = hash.toString("hex");
            PEER_ID = buf.slice(36, 56);
            PEER_ID = PEER_ID.toString();
            let DOWNLOADED = readUInt64BE(buf, 56), LEFT = readUInt64BE(buf, 64), UPLOADED = readUInt64BE(buf, 72), EVENT = buf.readUInt32BE(80);
            console.log("hash: ", hash);
            console.log("peer id: ", PEER_ID);
            console.log("A-downloaded: ", DOWNLOADED);
            console.log("A-LEFT: ", LEFT);
            console.log("A-uploaded: ", UPLOADED);
            console.log("A-EVENT: ", EVENT);
            console.log("A-peerPort: ", port);
            if (bufLength > 96) {
                console.log("96 bits long!");
                PEER_ADDRESS = buf.readUInt16BE(84);
                PEER_KEY = buf.readUInt16BE(88);
                NUM_WANT = buf.readUInt16BE(92);
                peerPort = buf.readUInt16BE(96);
                console.log("peer address: ", PEER_ADDRESS);
                console.log("peer key: ", PEER_KEY);
                console.log("num want: ", NUM_WANT);
                console.log("peerPort-after: ", peerPort);
            }
            client.mget([peerAddress + ":" + connectionIdHigh, peerAddress + ":" + connectionIdLow], (err, reply) => {
                if (!reply[0] || !reply[1] || err) {
                    console.log("damn.. stuck here...");
                    ERROR();
                    return;
                }
                console.log("peer+connection WORKED!");
                if (EVENT === 1) {
                    removePeer(peerAddress + ":" + peerPort, hash + ":leechers");
                    addPeer(peerAddress + ":" + peerPort, hash + ":seeders");
                    client.incr(hash + ":completed");
                    addHash(hash);
                }
                else if (EVENT === 2) {
                    console.log("EVENT 2 CALLED");
                    if (LEFT > 0)
                        addPeer(peerAddress + ":" + peerPort, hash + ":leechers");
                    else
                        addPeer(peerAddress + ":" + peerPort, hash + ":seeders");
                }
                else if (EVENT === 3) {
                    removePeer(peerAddress + ":" + peerPort, hash + ":leechers");
                    removePeer(peerAddress + ":" + peerPort, hash + ":seeders");
                    return;
                }
                client.mget([hash + ":seeders", hash + ":leechers"], (err, rply) => {
                    if (err) {
                        console.log("error 7");
                        ERROR();
                        return;
                    }
                    let addresses = addrToBuffer(rply[0], rply[1], LEFT);
                    responce = new buffer_1.Buffer(20);
                    responce.fill(0);
                    responce.writeUInt32BE(ACTION_ANNOUNCE, 0);
                    responce.writeUInt32BE(transaction_id, 4);
                    responce.writeUInt32BE(INTERVAL, 8);
                    responce.writeUInt32BE(addresses[0], 12);
                    responce.writeUInt32BE(addresses[1], 16);
                    responce = buffer_1.Buffer.concat([responce, addresses[2]]);
                    console.log("SEND PACKET BACK: ");
                    cb(responce);
                });
            });
            break;
        case ACTION_SCRAPE:
            console.log("SCRAPE CALLED...");
            client.incr("scrape");
            hash = buf.slice(16, 36);
            hash = hash.toString("hex");
            client.mget([hash + ":seeders", hash + ":leechers", hash + ":completed"], (err, rply) => {
                if (err) {
                    ERROR();
                    console.log("error1");
                    return;
                }
                let addresses = addrToBuffer(rply[0], rply[1], 1);
                responce = new buffer_1.Buffer(20);
                responce.fill(0);
                responce.writeUInt32BE(ACTION_SCRAPE, 0);
                responce.writeUInt32BE(transaction_id, 4);
                responce.writeUInt32BE(addresses[1], 8);
                responce.writeUInt32BE(rply[2], 12);
                responce.writeUInt32BE(addresses[0], 16);
                cb(responce);
            });
            break;
        default:
            ERROR();
    }
    function ERROR() {
        responce = new buffer_1.Buffer(11);
        responce.fill(0);
        responce.writeUInt32BE(ACTION_ERROR, 0);
        responce.writeUInt32BE(transaction_id, 4);
        responce.write("900", 8);
        cb(responce);
    }
    function addPeer(peer, where) {
        client.get(where, (err, reply) => {
            if (err) {
                console.log("error here2");
                return;
            }
            else {
                if (!reply)
                    reply = peer;
                else
                    reply = peer + "," + reply;
                console.log("peer to add: ", peer);
                reply = reply.split(",");
                reply = _.uniq(reply);
                if (reply.length > MAX_PEER_SIZE) {
                    reply = reply.slice(0, MAX_PEER_SIZE);
                }
                reply = reply.join(",");
                client.set(where, reply);
            }
        });
    }
    function removePeer(peer, where) {
        client.get(where, (err, reply) => {
            if (err) {
                console.log("ERROR 3 here..");
                return;
            }
            else {
                if (!reply)
                    return;
                else {
                    console.log("peer to remove: ", peer);
                    reply = reply.split(",");
                    let index = reply.indexOf(peer);
                    if (index > -1) {
                        reply.splice(index, 1);
                    }
                    reply = reply.join(",");
                    client.set(where, reply);
                }
            }
        });
    }
    function addrToBuffer(seeders, leechers, LEFT) {
        let leecherCount = 0, seederCount = 0, peerBuffer = null, peerBufferSize = 0;
        if (LEFT === 0 || !seeders || seeders === "")
            seeders = new buffer_1.Buffer(0);
        else {
            seeders = seeders.split(",");
            seederCount = seeders.length;
            seeders = seeders.map((addressPort) => {
                let addr = addressPort.split(":")[0];
                let port = addressPort.split(":")[1];
                addr = addr.split(".");
                let b = new buffer_1.Buffer(6);
                b.fill(0);
                b.writeUInt8(addr[0], 0);
                b.writeUInt8(addr[1], 1);
                b.writeUInt8(addr[2], 2);
                b.writeUInt8(addr[3], 3);
                b.writeUInt16BE(port, 4);
                return b;
            });
            seeders = buffer_1.Buffer.concat(seeders);
        }
        if (LEFT > 0 && seederCount > 50 && leechers > 15)
            leechers = leechers.slice(0, 15);
        if (!leechers || leechers === "")
            leechers = new buffer_1.Buffer(0);
        else {
            leechers = leechers.split(",");
            leecherCount = leechers.length;
            leechers = leechers.map((addressPort) => {
                let addr = addressPort.split(":")[0];
                let port = addressPort.split(":")[1];
                addr = addr.split(".");
                let b = new buffer_1.Buffer(6);
                b.fill(0);
                b.writeUInt8(addr[0], 0);
                b.writeUInt8(addr[1], 1);
                b.writeUInt8(addr[2], 2);
                b.writeUInt8(addr[3], 3);
                b.writeUInt16BE(port, 4);
                return b;
            });
            leechers = buffer_1.Buffer.concat(leechers);
        }
        peerBuffer = buffer_1.Buffer.concat([seeders, leechers]);
        console.log("peerBuffer: ", peerBuffer);
        return [leecherCount, seederCount, peerBuffer];
    }
    function addHash(hash) {
        client.get("hashes", (err, reply) => {
            if (err) {
                console.log("error4");
                return;
            }
            if (!reply)
                reply = hash;
            else
                reply = hash + "," + reply;
            reply = reply.split(",");
            reply = _.uniq(reply);
            reply = reply.join(",");
            client.set("hashes", reply);
            client.set(hash + ":time", Date.now());
        });
    }
    function getHashes() {
        let r = client.get("hashes", (err, reply) => {
            if (err) {
                console.log("error5");
                return null;
            }
            reply = reply.split(",");
            return reply;
        });
        return r;
    }
}
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Server;
