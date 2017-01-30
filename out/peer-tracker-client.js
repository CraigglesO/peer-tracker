"use strict";
const peer_tracker_1 = require("./peer-tracker");
let client = new peer_tracker_1.Client.Udp('start', '0.0.0.0', 1337, 6688, '01234567890123456789', 0, 0, 0);
client.on("announce", (interval, leechers, seeders, addresses) => {
    console.log('interval:', interval);
    console.log('leechers:', leechers);
    console.log('seeders:', seeders);
    console.log('addresses:', addresses);
});
