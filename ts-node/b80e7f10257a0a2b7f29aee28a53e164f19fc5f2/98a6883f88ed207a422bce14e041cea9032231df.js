"use strict";
const http_1 = require("http");
const WebSocketServer = require("ws");
const express = require("express");
const dgram = require("dgram");
const readUInt64BE = require("readuint64be");
const buffer_1 = require("buffer");
const _ = require("lodash");
// Health Insurrance:
process.on("uncaughtException", function (err) {
    console.log(err);
});
const debug = require("debug")("PeerTracker:Server"), redis = require("redis"), GeoIpNativeLite = require("geoip-native-lite"), bencode = require("bencode");
// Load in GeoData
GeoIpNativeLite.loadDataSync();
// Keep statistics going, update every 30 min
let stats = {
    seedCount: 0,
    leechCount: 0,
    torrentCount: 0,
    activeTcount: 0,
    scrapeCount: 0,
    successfulDown: 0,
    countries: {}
};
const ACTION_CONNECT = 0, ACTION_ANNOUNCE = 1, ACTION_SCRAPE = 2, ACTION_ERROR = 3, INTERVAL = 1801, startConnectionIdHigh = 0x417, startConnectionIdLow = 0x27101980;
// Without using streams, this can handle ~320 IPv4 addresses. More doesn't necessarily mean better.
const MAX_PEER_SIZE = 1500;
const FOUR_AND_FIFTEEN_DAYS = 415 * 24 * 60 * 60; // assuming start time is seconds for redis;
// Redis
let client;
class Server {
    constructor(opts) {
        this._debug = (...args) => {
            args[0] = "[" + this._debugId + "] " + args[0];
            debug.apply(null, args);
        };
        const self = this;
        if (!opts)
            opts = { port: 80, udpPort: 1337, docker: false };
        self._debugId = ~~((Math.random() * 100000) + 1);
        self._debug("peer-tracker Server instance created");
        self.PORT = opts.port;
        self.udpPORT = opts.udpPort;
        self.server = http_1.createServer();
        self.wss = new WebSocketServer.Server({ server: self.server });
        self.udp4 = dgram.createSocket({ type: "udp4", reuseAddr: true });
        self.app = express();
        // PREP VISUAL AID:
        console.log(`
        .
        |
        |
        |
       |||
      /___\\
     |_   _|
     | | | |
    |  | |  |
    |__| |__|
    |  | |  |
    |  | |  |
    |  | |  |         Peer Tracker 1.1.0
    |  | |  |
    |  | |  |         Running in standalone mode
    |  | |  |         UDP PORT:       ${self.udpPORT}
    |  | |  |         HTTP & WS PORT: ${self.PORT}
    |  | |  |
    |  |_|  |
    |__| |__|
    |  | |  |         LET'S BUILD AN EMPIRE!
   |   | |   |           https://github.com/CraigglesO/peer-tracker
   |   | |   |
  |    | |    |
  |____|_|____|
      `);
        // Redis
        if (opts.docker)
            client = redis.createClient("6379", "redis");
        else
            client = redis.createClient();
        // If an error occurs, print it to the console
        client.on("error", function (err) {
            console.log("Redis error: " + err);
        });
        client.on("ready", function () {
            console.log(new Date() + ": Redis is up and running.");
        });
        self.app.set("trust proxy", function (ip) {
            return true;
        });
        // Express
        self.app.get("/", function (req, res) {
            let ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
            if (ip.indexOf("::ffff:") !== -1)
                ip = ip.slice(7);
            res.status(202).send("Welcome to the Empire. Your address: " + ip);
        });
        self.app.get("/stat.json", function (req, res) {
            res.status(202).send(stats);
        });
        self.app.get("/stat", function (req, res) {
            // { seedCount, leechCount, torrentCount, activeTcount, scrapeCount, successfulDown, countries };
            let parsedResponce = `<h1><span style="color:blue;">V1.0.3</span> - ${stats.torrentCount} Torrents {${stats.activeTcount} active}</h1>\n
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
        self.server.listen(self.PORT, function () { console.log(new Date() + ": HTTP Server Ready" + "\n" + new Date() + ": Websockets Ready."); });
        // WebSocket:
        self.wss.on("connection", function connection(ws) {
            // let location = url.parse(ws.upgradeReq.url, true);
            let ip;
            let peerAddress;
            let port;
            if (opts.docker) {
                ip = ws.upgradeReq.headers["x-forwarded-for"];
                peerAddress = ip.split(":")[0];
                port = ip.split(":")[1];
            }
            else {
                peerAddress = ws._socket.remoteAddress;
                port = ws._socket.remotePort;
            }
            if (peerAddress.indexOf("::ffff:") !== -1)
                peerAddress = peerAddress.slice(7);
            console.log("peerAddress", peerAddress);
            ws.on("message", function incoming(msg) {
                handleMessage(msg, peerAddress, port, "ws", (reply) => {
                    ws.send(reply);
                });
            });
        });
        // UDP:
        self.udp4.bind(self.udpPORT);
        self.udp4.on("message", function (msg, rinfo) {
            handleMessage(msg, rinfo.address, rinfo.port, "udp", (reply) => {
                self.udp4.send(reply, 0, reply.length, rinfo.port, rinfo.address, (err) => {
                    if (err) {
                        console.log("udp4 error: ", err);
                    }
                    ;
                });
            });
        });
        self.udp4.on("error", function (err) { console.log("error", err); });
        self.udp4.on("listening", () => { console.log(new Date() + ": UDP-4 Bound and ready."); });
        self.updateStatus((info) => {
            stats = info;
        });
        setInterval(() => {
            console.log("STAT UPDATE, " + Date.now());
            self.updateStatus((info) => {
                stats = info;
            });
        }, 30 * 60 * 1000);
    }
    updateStatus(cb) {
        const self = this;
        // Get hashes -> iterate through hashes and get all peers and leechers
        // Also get number of scrapes 'scrape'
        // Number of active hashes hash+':time'
        let NOW = Date.now(), seedCount = 0, // check
        leechCount = 0, // check
        torrentCount = 0, // check
        activeTcount = 0, // check
        scrapeCount = 0, // check
        successfulDown = 0, // check
        countries = {};
        client.get("hashes", (err, reply) => {
            if (!reply)
                return;
            let hashList = reply.split(",");
            torrentCount = hashList.length;
            client.get("scrape", (err, rply) => {
                if (err) {
                    return;
                }
                if (!rply)
                    return;
                scrapeCount = rply;
            });
            hashList.forEach((hash, i) => {
                client.mget([hash + ":seeders", hash + ":leechers", hash + ":time", hash + ":completed"], (err, rply) => {
                    if (err) {
                        return;
                    }
                    // iterate through:
                    // seeders
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
    }
}
// MESSAGE FUNCTIONS:
function handleMessage(msg, peerAddress, port, type, cb) {
    // PACKET SIZES:
    // CONNECT: 16 - ANNOUNCE: 98 - SCRAPE: 16 OR (16 + 20 * n)
    let buf = new buffer_1.Buffer(msg), bufLength = buf.length, transaction_id = 0, action = null, connectionIdHigh = null, connectionIdLow = null, hash = null, responce = null, PEER_ID = null, PEER_ADDRESS = null, PEER_KEY = null, NUM_WANT = null, peerPort = port, peers = null;
    // Ensure packet fullfills the minimal 16 byte requirement.
    if (bufLength < 16) {
        ERROR();
    }
    else {
        // Get generic data:
        connectionIdHigh = buf.readUInt32BE(0),
            connectionIdLow = buf.readUInt32BE(4),
            action = buf.readUInt32BE(8),
            transaction_id = buf.readUInt32BE(12); // 12    32-bit integer  transaction_id
    }
    switch (action) {
        case ACTION_CONNECT:
            // Check whether the transaction ID is equal to the one you chose.
            if (startConnectionIdLow !== connectionIdLow || startConnectionIdHigh !== connectionIdHigh) {
                ERROR();
                break;
            }
            // Create a new Connection ID and Transaction ID for this user... kill after 30 seconds:
            let newConnectionIDHigh = ~~((Math.random() * 100000) + 1);
            let newConnectionIDLow = ~~((Math.random() * 100000) + 1);
            client.setex(peerAddress + ":" + newConnectionIDHigh, 60, 1);
            client.setex(peerAddress + ":" + newConnectionIDLow, 60, 1);
            client.setex(peerAddress + ":" + startConnectionIdLow, 60, 1);
            client.setex(peerAddress + ":" + startConnectionIdHigh, 60, 1);
            // client.setex(peerAddress + ':' + transaction_id     , 30 * 1000, 1); // THIS MIGHT BE WRONG
            // Create a responce buffer:
            responce = new buffer_1.Buffer(16);
            responce.fill(0);
            responce.writeUInt32BE(ACTION_CONNECT, 0); // 0       32-bit integer  action          0 // connect
            responce.writeUInt32BE(transaction_id, 4); // 4       32-bit integer  transaction_id
            responce.writeUInt32BE(newConnectionIDHigh, 8); // 8       64-bit integer  connection_id
            responce.writeUInt32BE(newConnectionIDLow, 12); // 8       64-bit integer  connection_id
            cb(responce);
            break;
        case ACTION_ANNOUNCE:
            // Checks to make sure the packet is worth analyzing:
            // 1. packet is atleast 84 bytes
            if (bufLength < 84) {
                ERROR();
                break;
            }
            // Minimal requirements:
            hash = buf.slice(16, 36);
            hash = hash.toString("hex");
            PEER_ID = buf.slice(36, 56); // -WD0017-I0mH4sMSAPOJ && -LT1000-9BjtQhMtTtTc
            PEER_ID = PEER_ID.toString();
            let DOWNLOADED = readUInt64BE(buf, 56), LEFT = readUInt64BE(buf, 64), UPLOADED = readUInt64BE(buf, 72), EVENT = buf.readUInt32BE(80);
            if (bufLength > 96) {
                PEER_ADDRESS = buf.readUInt16BE(84);
                PEER_KEY = buf.readUInt16BE(88);
                NUM_WANT = buf.readUInt16BE(92);
                peerPort = buf.readUInt16BE(96);
            }
            // 2. check that Transaction ID and Connection ID match
            client.mget([peerAddress + ":" + connectionIdHigh, peerAddress + ":" + connectionIdLow], (err, reply) => {
                if (!reply[0] || !reply[1] || err) {
                    ERROR();
                    return;
                }
                addHash(hash);
                // Check EVENT // 0: none; 1: completed; 2: started; 3: stopped
                // If 1, 2, or 3 do sets first.
                if (EVENT === 1) {
                    // Change the array this peer is housed in.
                    removePeer(peerAddress + ":" + peerPort, hash + type + ":leechers");
                    addPeer(peerAddress + ":" + peerPort, hash + type + ":seeders");
                    // Increment total users who completed file
                    client.incr(hash + ":completed");
                }
                else if (EVENT === 2) {
                    // Add to array (leecher array if LEFT is > 0)
                    if (LEFT > 0)
                        addPeer(peerAddress + ":" + peerPort, hash + type + ":leechers");
                    else
                        addPeer(peerAddress + ":" + peerPort, hash + type + ":seeders");
                }
                else if (EVENT === 3) {
                    // Remove peer from array (leecher array if LEFT is > 0)
                    removePeer(peerAddress + ":" + peerPort, hash + type + ":leechers");
                    removePeer(peerAddress + ":" + peerPort, hash + type + ":seeders");
                    return;
                }
                client.mget([hash + type + ":seeders", hash + type + ":leechers"], (err, rply) => {
                    if (err) {
                        ERROR();
                        return;
                    }
                    // Convert all addresses to a proper hex buffer:
                    // Addresses return: 0 - leechers; 1 - seeders; 2 - hexedUp address-port pairs; 3 - resulting buffersize
                    let addresses = addrToBuffer(rply[0], rply[1], LEFT);
                    // Create a responce buffer:
                    responce = new buffer_1.Buffer(20);
                    responce.fill(0);
                    responce.writeUInt32BE(ACTION_ANNOUNCE, 0); // 0           32-bit integer  action          1 -> announce
                    responce.writeUInt32BE(transaction_id, 4); // 4           32-bit integer  transaction_id
                    responce.writeUInt32BE(INTERVAL, 8); // 8           32-bit integer  interval
                    responce.writeUInt32BE(addresses[0], 12); // 12          32-bit integer  leechers
                    responce.writeUInt32BE(addresses[1], 16); // 16          32-bit integer  seeders
                    responce = buffer_1.Buffer.concat([responce, addresses[2]]); // 20 + 6 * n  32-bit integer  IP address
                    // 24 + 6 * n  16-bit integer  TCP port
                    cb(responce);
                });
            });
            break;
        case ACTION_SCRAPE:
            // Check whether the transaction ID is equal to the one you chose.
            // 2. check that Transaction ID and Connection ID match
            // addresses return: 0 - leechers; 1 - seeders; 2 - hexedUp address-port pairs; 3 - resulting buffersize
            // Create a responce buffer:
            client.incr("scrape");
            let responces = new buffer_1.Buffer(8);
            responces.fill(0);
            responces.writeUInt32BE(ACTION_SCRAPE, 0); // 0           32-bit integer  action          2 -> scrape
            responces.writeUInt32BE(transaction_id, 4); // 4           32-bit integer  transaction_id
            let bufferSum = [];
            // LOOP THROUGH REQUESTS
            for (let i = 16; i < (buf.length - 16); i += 20) {
                hash = buf.slice(i, i + 20);
                hash = hash.toString("hex");
                client.mget([hash + type + ":seeders", hash + type + ":leechers", hash + type + ":completed"], (err, rply) => {
                    if (err) {
                        ERROR();
                        return;
                    }
                    // convert all addresses to a proper hex buffer:
                    let addresses = addrToBuffer(rply[0], rply[1], 1);
                    let responce = new buffer_1.Buffer(20);
                    responce.fill(0);
                    responce.writeUInt32BE(addresses[1], 8); // 8 + 12 * n  32-bit integer  seeders
                    responce.writeUInt32BE(rply[2], 12); // 12 + 12 * n 32-bit integer  completed
                    responce.writeUInt32BE(addresses[0], 16); // 16 + 12 * n 32-bit integer  leechers
                    bufferSum.push(responce);
                    if ((i + 16) >= (buf.length - 16)) {
                        let scrapes = buffer_1.Buffer.concat(bufferSum);
                        responces = buffer_1.Buffer.concat([responces, scrapes]);
                        cb(responces);
                    }
                });
            }
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
                ERROR();
                return;
            }
            else {
                if (!reply)
                    reply = peer;
                else
                    reply = peer + "," + reply;
                reply = reply.split(",");
                reply = _.uniq(reply);
                // Keep the list under MAX_PEER_SIZE;
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
                ERROR();
                return;
            }
            else {
                if (!reply)
                    return;
                else {
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
        // Addresses return: 0 - leechers; 1 - seeders; 2 - hexedUp address-port pairs; 3 - resulting buffersize
        // Also we don't need to send the users own address
        // If peer is a leecher, send more seeders; if peer is a seeder, send only leechers
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
        // Addresses return: 0 - leechers; 1 - seeders; 2 - hexedUp address-port pairs; 3 - resulting buffersize
        return [leecherCount, seederCount, peerBuffer];
    }
    // Add a new hash to the swarm, ensure uniqeness
    function addHash(hash) {
        client.get("hashes", (err, reply) => {
            if (err) {
                ERROR();
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
                ERROR();
                return null;
            }
            reply = reply.split(",");
            return reply;
        });
        return r;
    }
}
function binaryToHex(str) {
    if (typeof str !== "string") {
        str = String(str);
    }
    return buffer_1.Buffer.from(str, "binary").toString("hex");
}
function hexToBinary(str) {
    if (typeof str !== "string") {
        str = String(str);
    }
    return buffer_1.Buffer.from(str, "hex").toString("binary");
}
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Server;
//# sourceMappingURL=/Users/connor/Desktop/Programming/myModules/peer-tracker/ts-node/b80e7f10257a0a2b7f29aee28a53e164f19fc5f2/98a6883f88ed207a422bce14e041cea9032231df.js.map