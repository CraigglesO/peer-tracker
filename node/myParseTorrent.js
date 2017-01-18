const bencode = require('bencode');
const fs = require('fs');

var torrent = fs.readFileSync('./EX2.torrent');

var result = bencode.decode(torrent);

var info = {};
info.info = {};

if (result['encoding'])
  info['encoding'] = result['encoding'].toString();

var encoding = info['encoding'];

if (result['announce'])
  info.trackers = [result.announce.toString()];

if (result['created by'])
  info['created by'] = result['created by'].toString();

if (result.info['name'])
  info.info.name = result.info['name'].toString();

if (result.info['files']) {
  info.info['files'] = result.info['files'];
  info.info['files'] = info.info['files'].map((file) => {
    file.path = file.path.map((path) => {
      path = path.toString();
      return path;
    });
    console.log('file.path: ', file.path);
    file.path = file.path.join('/');
    return file;
  });
}

if (result.info['pieces']) {
  info.info.pieces = result.info['pieces'].toString('hex');
}

if (result.info['private'])
  info['private'] = result.info['private'];

console.log(result);

console.log();

console.log(info);
console.log('INFO.INFO.FILES');
console.log(info.info.files);
