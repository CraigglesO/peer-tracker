"use strict";
const test = require("blue-tape");
const crypto = require("crypto");
test("This is for the interwebs", (t) => {
    t.plan(1);
    t.true(true);
    t.end();
});
function randomHash() {
    let num = Math.floor(Math.random() * (10000000 - 1)) + 1;
    let rh = crypto.createHash("sha1").update(num.toString()).digest("hex");
    return rh;
}
