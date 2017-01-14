var parseTorrent = require('parse-torrent')
var fs = require('fs')

var x = parseTorrent(fs.readFileSync(__dirname + '/screen.torrent'))

console.log(x);
