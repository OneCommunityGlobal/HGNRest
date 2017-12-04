var getdahsboardData = function (callback) {

  var now = new Date();
  var mongoClient = require('mongodb').MongoClient,
    assert = require('assert');

  var url = 'mongodb://localhost:27017/hgnData';

  mongoClient.connect(url, function (err, db) {
    db.collection('dashboard').find({}, {
      _id: 0
    }).toArray(function (err, items) {
      if (err) throw err;
      console.log("Dashboard service hit at: " + now);
      callback(items);
    });
  });
}

exports.getdahsboardData = getdahsboardData;
