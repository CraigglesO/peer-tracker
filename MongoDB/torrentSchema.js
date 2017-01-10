const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const keySchema = new Schema({
  hash: String,
  name: String,
  complete: Number,
  incomplete: Number,
  peers: [ String ],
  lastAccess: Number
});

const Key = mongoose.model('Key', keySchema);

module.exports = Key;
