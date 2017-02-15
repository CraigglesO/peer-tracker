import { Client }  from "../peer-tracker";
import * as test   from "blue-tape";
import * as crypto from "crypto";

test("udp Client downloading scrape", (t) => {
  t.plan(14);
  let r = randomHash();

  let client = Client.udp("scrape", "0.0.0.0", 1337, 6622, r, 10, 10, 10);

  client.on("announce", (interval, leechers, seeders, addresses) => {
    t.equal(interval, 1801,           "announce - interval");
    t.equal(leechers, 0,              "announce - leechers");
    t.equal(seeders,  0,              "announce - seeders");
    t.equal(addresses.toString(), '', "announce - addresses");
  });

  client.on("scrape", (seeders, completed, leechers) => {
    t.equal(seeders,   0, "scrape - seeders");
    t.equal(completed, 0, "scrape - completed");
    t.equal(leechers,  0, "scrape - leechers");
  });

  setTimeout(() => {
    client = Client.udp("scrape", "0.0.0.0", 1337, 6623, r, 10, 10, 10);
    client.on("announce", (interval, leechers, seeders, addresses) => {
      t.equal(interval, 1801,           "announce - interval");
      t.equal(leechers, 1,              "announce - leechers");
      t.equal(seeders,  0,              "announce - seeders");
      t.equal(addresses.toString(), '127.0.0.1:6622', "announce - addresses");
    });

    client.on("scrape", (seeders, completed, leechers) => {
      t.equal(seeders,   0, "scrape - seeders");
      t.equal(completed, 0, "scrape - completed");
      t.equal(leechers,  0, "scrape - leechers");
    });
  }, 1000);
});

test("ws Client downloading scrape", (t) => {
  t.plan(14);
  let r = randomHash();

  let client = Client.ws("scrape", "0.0.0.0", 80, 6622, r, 10, 10, 10);

  client.on("announce", (interval, leechers, seeders, addresses) => {
    t.equal(interval, 1801,           "announce - interval");
    t.equal(leechers, 0,              "announce - leechers");
    t.equal(seeders,  0,              "announce - seeders");
    t.equal(addresses.toString(), '', "announce - addresses");
  });

  client.on("scrape", (seeders, completed, leechers) => {
    t.equal(seeders,   0, "scrape - seeders");
    t.equal(completed, 0, "scrape - completed");
    t.equal(leechers,  0, "scrape - leechers");
  });

  setTimeout(() => {
    client = Client.ws("scrape", "0.0.0.0", 80, 6623, r, 10, 10, 10);
    client.on("announce", (interval, leechers, seeders, addresses) => {
      t.equal(interval, 1801,           "announce - interval");
      t.equal(leechers, 1,              "announce - leechers");
      t.equal(seeders,  0,              "announce - seeders");
      t.equal(addresses.toString(), '0.0.0.0:0', "announce - addresses");
    });

    client.on("scrape", (seeders, completed, leechers) => {
      t.equal(seeders,   0, "scrape - seeders");
      t.equal(completed, 0, "scrape - completed");
      t.equal(leechers,  0, "scrape - leechers");
    });
  }, 1000);
});

function randomHash() {
  let num = Math.floor(Math.random() * (10000000 - 1)) + 1;
  let rh  = crypto.createHash("sha1").update(num.toString()).digest("hex");

  return rh;
}
