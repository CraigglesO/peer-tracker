const udpClient = require('./udpClient.js');


const udp = new udpClient(8000, '0.0.0.0', '45F7C21FE88C389DD24D6523678C17C9170648A7');

//udp.announce( 1, {n: 'The Catcher in the Rye'} );

// udp.announce(2);
//
//
udp.on('message', (res) => {
  console.log(res);
});


// exports.ACTIONS = { CONNECT: 0, ANNOUNCE: 1, SCRAPE: 2, ERROR: 3 }
// exports.EVENTS = { update: 0, completed: 1, started: 2, stopped: 3 }
