const express = require('express');
const router = express.Router();

// router.get('/announce/:number/:hash', function (req, res) {
//   let result;
//   if (number === 2) {
//     client.mget([hash + 'peers', hash + 'downloading', hash + 'completed'], (err, reply) => {
//       if (err) { result = {r: 'fail'};}
//       else {
//         result = {r: reply};
//       }
//       res.send(result);
//     });
//   }
// });


module.exports = router;
