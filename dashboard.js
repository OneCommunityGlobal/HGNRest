var getdahsboardData = function (callback) {

  var now = new Date();
  var mongoClient = require('mongodb').MongoClient,
    assert = require('assert');

    var uri = 'mongodb://hgnData:Test123@cluster0-shard-00-00-gl12q.mongodb.net:27017/hgnData?ssl=true&replicaSet=Cluster0-shard-0&authSource=admin';

  mongoClient.connect(uri, function (err, db) {
    db.collection('dashboard').find({}, {
      _id: 0
    }).toArray(function (err, items) {
      if (err) throw err;
      console.log("Dashboard service hit at: " + now);
      console.log(items);
      callback(items);
    });
  });
}

exports.getdahsboardData = getdahsboardData;
