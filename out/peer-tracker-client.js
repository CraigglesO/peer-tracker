"use strict";
const peer_tracker_1 = require("./peer-tracker");
let client = peer_tracker_1.Client.udp("scrape", "0.0.0.0", 3456, 1339, "a123d5678df123456b89ad234567890c23456a89", 10, 10, 10);
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
