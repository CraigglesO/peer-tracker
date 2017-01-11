const EventEmitter = require('events').EventEmitter;
const inherits = require('inherits');
const mongoose = require('mongoose');
const Key = require('./torrentSchema');

inherits(MongoDBClient, EventEmitter);

function MongoDBClient() {
  EventEmitter.call(this);
}

MongoDBClient.prototype.create = function(hash, peer) {
  let time = Date.now();
  const newKey = new Key({ hash: hash, complete: 1, incomplete: 0, peers: [ peer ], lastAccess: time });
  newKey.save(function (err) {
    if (err) return handleError(err);
  });
}

MongoDBClient.prototype.find = function(hash, cb) {
  mongoose.model('Key').findOne({"hash": hash},function(err , result) {
    if (err) {
      console.log(err);
    }
    cb(result);
  });
}

MongoDBClient.prototype.update = function(hash, info) {
  mongoose.model('Key').findOne({"hash": hash},function(err , key) {
    if (err) {
      console.log(err);
    }
    //update here:
    let time = Date.now();
    key.lastAccess = time;
    if (info.complete) {
      key.complete++;
      key.incomplete--;
    }

    if (info.incomplete) {
      key.incomplete++;
    }

    if (info.leaving) {
      if (info.status === 'incomplete'){
        key.incomplete--;
      }
      if (info.status === 'complete'){
        key.complete--;
      }
    }

    if (info.peer) {
      key.peers.push(info.peer);
    }

    //Save changes:
    key.save(function (err) {
      if (err) {
        console.log(err);
      }
    });
  });
}


module.exports = new MongoDBClient();
