"use strict";
const peer_tracker_1 = require("./peer-tracker");
// let client = Client.udp("scrape", "0.0.0.0", 1337, 6688, "0123456789012345678901234567890123456789", 0, 0, 0);
// let client = Client.ws("scrape", "0.0.0.0", 80, 6688, ["0123456789012345678901234567890123456789", "0123456789012345678901234567890123456789", "0123456789012345678901234567890123456789"], 0, 0, 0);
let client = peer_tracker_1.Client.ws("scrape", "0.0.0.0", 80, 6688, "a32345678d0123456789c1234567b90123456789", 1, 1, 1);
client.on("announce", (interval, leechers, seeders, addresses) => {
    console.log("interval:", interval);
    console.log("leechers:", leechers);
    console.log("seeders:", seeders);
    console.log("addresses:", addresses);
});
client.on("scrape", (seeders, completed, leechers) => {
    console.log("seeders", seeders);
    console.log("completed", completed);
    console.log("leechers", leechers);
});
//# sourceMappingURL=/Users/connor/Desktop/2017/PeerTracker/node/ts-node/9306d8023029a899f149722003eaf06449924f94/ee38b90a5f4742cf36ffa84e6480d5df1003b6c1.js.map