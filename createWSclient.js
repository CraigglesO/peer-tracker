// const udpClient = require('./udpClient');
const udpClient = require('./wsClient');

// udp1 = new udpClient('tracker.coppersurfer.tk', 6969, "02a7cd7bce95af47328406734cc42db591f78782");
udp1 = new udpClient('138.197.92.39', 1337, "02a7cd7bce95af47328406734cc42db591f78782");
//02a7cd7bce95af47328406734cc42db591f78782
//02a7cd7bce95af47328406734cc42db591f78782
udp1.on('listening', (address) => {
  console.log('ready to go: ', address);
});

udp1.on('connect', (rinfo) => {
  // successful connect with data about the servers ip and port (that we already know)
  console.log('successful connection: ', rinfo);
});

udp1.on('scrape', (seeders, completed, leechers, timeTillNextScrape) => {
  //scraped data here
  console.log('seeders: ', seeders);
  console.log('completed: ', completed);
  console.log('leechers: ', leechers);
  console.log('time until next update: ', timeTillNextScrape, 's');
});

udp1.on('announce', (interval, leechers, seeders, addresses) => {
  //announcement recieved data goes here
  console.log('seeders: ', seeders);
  console.log('leechers: ', leechers);
  console.log('interval: ', interval);
  console.log('addresses: ', addresses);
});

udp1.on('error', (err) => {
  console.log(err);
})


// //Things to change over time:
// setTimeout(() => {
//   console.log('started!!!');
//   udp1.DOWNLOADED = 10000;
//   udp1.LEFT = 0;
//   udp1.UPLOADED = 500;
//   udp1.started();
// }, 10 * 1000); // wait 20 seconds...
