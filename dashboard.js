module.exports = {
    getdahsboardData: function (callback) {

        var mongoClient = require('mongodb').MongoClient,
            assert = require('assert');

        var url = 'mongodb://localhost:27017/hgnData';

        mongoClient.connect(url, function (err, db) {
            db.collection('dashboard').find({}, {"_id":0, "leaderboardData.dayData":1}).toArray(function (err, items) {
                if (err) throw err;
                callback(items);
            });
        });
    }
}
