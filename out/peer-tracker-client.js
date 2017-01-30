"use strict";
const peer_tracker_1 = require("./peer-tracker");
let client = peer_tracker_1.Client.ws("scrape", "0.0.0.0", 80, 6688, "0123456789012345678901234567890123456789", 0, 0, 0);
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
