"use strict";
const peer_tracker_1 = require("./peer-tracker");
let client = peer_tracker_1.Client.udp("scrape", "tracker.coppersurfer.tk", 6969, 6688, "d1910c0bee7c1a1a38f1d63695449f2419da777a", 0, 0, 1000);
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
