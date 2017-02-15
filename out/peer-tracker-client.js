"use strict";
const peer_tracker_1 = require("./peer-tracker");
let client = peer_tracker_1.Client.ws("complete", "tracker.empire-js.us", 80, 1339, "ab23b56d8df123456c89ad234567890c23456a89", 10, 10, 10);
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
