# peer-tracker [![travis][travis-image]][travis-url] [![npm][npm-image]][npm-url] [![downloads][downloads-image]][downloads-url]

[![Greenkeeper badge](https://badges.greenkeeper.io/CraigglesO/peer-tracker.svg)](https://greenkeeper.io/)

[travis-image]: https://travis-ci.org/CraigglesO/peer-tracker.svg?branch=master
[travis-url]: https://travis-ci.org/CraigglesO/peer-tracker
[npm-image]: https://img.shields.io/npm/v/peer-tracker.svg
[npm-url]: https://npmjs.org/package/peer-tracker
[downloads-image]: https://img.shields.io/npm/dm/peer-tracker.svg
[downloads-url]: https://npmjs.org/package/peer-tracker

### Lightweight BitTorrent Tracker Client & (Persistent) Server Implementation
<br />
<br />
<div align="center">
  <img src ="https://github.com/CraigglesO/peer-tracker/blob/master/img/tracker.png" />
</div>
<br />
<br />
<br />
### About

**OFFICIALLY VERSION 1!**

#### Example Use

See a working example [HERE](http://tracker.empire-js.us/stat)

Tutorial to use on a Digital Ocean server here:

**START USING DIGITAL OCEAN AND GET $10 FREE**
[CLICK HERE](https://m.do.co/c/d93e8feef9dc)

Docker images:
  * **REDIS** `oconnorct1/redis:latest`
  * **NGINX** `oconnorct1/nginx:latest`
  * **NODE**  `oconnorct1/peer-tracker:latest`

#### Ingenuity

**The first of it's kind! A smart persistent Bittorent tracker.**

If one server crashes, the system will not fail.

Nginx will handle distributing the load.

Using a Redis server, memory will be stored intermittently to ensure speed and efficiency over memory, as some loss in peers is ok.

Paired with client software, this package is ready to go.

#### Functionality

* Scrape support
* **NEW** Multi-Scrape support!!!!
* WebSocket support
* Multi-server support
* Docker compatible
* NGinX ready

## Install

``` javascript
npm install peer-tracker

```

## Usage

  **Server**
``` javascript
new Server();
```

Yep, literally that simple.
(Be sure to have a Redis instance running)

The server does take options, however:

``` javascript

let opts = {
  port:    80    // Default
  udpPort: 1337  // Default
  docker:  false // Default
}

new Server(opts);
```

  **Client**
  ``` javascript
// Scrape one hash
let client = Client.udp("scrape", "0.0.0.0", 1337, 6688, "0123456789012345678901234567890123456789", 0, 0, 0);
// OR ws:
// Scrape multiple hashes:
let client = Client.ws("scrape", "0.0.0.0", 80, 6688, ["0123456789012345678901234567890123456789", "0123456789012345678901234567890123456789"], 0, 0, 0);


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

client.on("error", (err) => {
  console.log("error:", err);
})

  ```

Client will auto-self-destruct upon completion.

`SERVER`

Server(opts);
  * opts: Options

``` javascript
interface Options {
  port:    number;
  udpPort: number;
  docker:  Boolean
}
```


`UDP CLIENT:`

**udp(announcement, trackerHost, port, myPort, infoHash, left, uploaded, downloaded)**
  * _announcement_ type: string
    * `scrape`
    * `complete`
    * `start`
    * `stop`
    * `update`
  * _trackerHost_: string
    * **UDP**: `0.0.0.0`
  * _port_: number
  * _myPort_: number
  * _infoHash_: string
  * _left_: number
  * _uploaded_: number
  * _downloaded_: number

`WS CLIENT:`

**ws(announcement, trackerHost, port, myPort, infoHash, left, uploaded, downloaded)**
  * _announcement_ type: string
    * `scrape`
    * `complete`
    * `start`
    * `stop`
    * `update`
  * _trackerHost_: string
    * **WSS**: `0.0.0.0`
  * _port_: number
  * _myPort_: number
  * _infoHash_: string
  * _left_: number
  * _uploaded_: number
  * _downloaded_: number



## license

### ISC License (Open Source Initiative)

ISC License (ISC)
Copyright <2017> <Craig OConnor>

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

[Craig OConnor](http://connor-craig.us).
