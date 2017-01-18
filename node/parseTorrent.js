var parseTorrent = require('parse-torrent')
var fs = require('fs')

var x = parseTorrent(fs.readFileSync(__dirname + '/MOVIE.torrent'))

console.log(x.pieces.length);
