import { Client } from "./peer-tracker";

// let client = Client.udp("scrape", "0.0.0.0", 1337, 6688, "0123456789012345678901234567890123456789", 0, 0, 0);

// let client = Client.ws("scrape", "0.0.0.0", 80, 6688, ["0123456789012345678901234567890123456789", "0123456789012345678901234567890123456789", "0123456789012345678901234567890123456789"], 0, 0, 0);
let client = Client.ws("complete", "tracker.empire-js.us", 80, 1339, "ab23b56d8df123456c89ad234567890c23456a89", 10, 10, 10);


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
