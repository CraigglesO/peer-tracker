var peerid = require('bittorrent-peerid')
var nonParsed = Buffer.from('2d4c54313030302d796845523463554a3077652a', 'hex');
console.log('buff: ', nonParsed);
nonParsed = peerid(nonParsed);
//var parsed = peerid('-WD0017-I0mH4sMSAPOJ')

console.log(nonParsed.client, nonParsed.version)
