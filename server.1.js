var express = require('express');
var mongoose = require('mongoose');
var { Schema } = mongoose;
var dashboard = require('./dashboard');
var dd = require('./DummyData');
var bodyParser = require('body-parser')

var Profile = require('./models/profile');

var app = express();

app.use(function (req, res, next) {
	res.setHeader('Access-Control-Allow-Origin', 'http://localhost:4200');
	//res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
	//added the content-Type to authorization after ESA implementation.
	res.setHeader("Access-Control-Allow-Headers", "Content-Type, authorization");
	res.header('Access-Control-Allow-Methods', 'POST, GET, PUT, DELETE, OPTIONS');
	// intercept OPTIONS method
	// this allows cross domain requests to come from Ember, as Ember first sends an OPTIONS request
	if ('OPTIONS' == req.method) {
		res.sendStatus(200);
	}
	else {
		next();
	}
});



app.use(bodyParser.json());       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
	extended: true
}));
// Connects to local Database, if the database is not present creates one for us.
var db = mongoose.connect('mongodb://localhost/hgnData');
mongoose.set('debug', true);
//dd.dummydata();
var ProfileRouter = express.Router();





//sow:Added for UserManagement
var userSchema = new Schema({
	userName: String,
	firstName: String,
	lastName: String,
	email: String,
	contact: String,
	role: String,
});


var Timelog = mongoose.model('timelog', timelogSchema);
var user = mongoose.model('user', userSchema);








app.post('/api/token', function (req, res) {
	console.log(req.body)
	if (req.body.username === 'test' && req.body.password === 'test') {
		res.send({ access_token: "12345" });
	}
});

app.get('/api/', function (req, res) {
	res.send('Success');
});

// app.get('/api/profiles', function (req, res) {
// 	Profile.find({}, function (err, docs) {
// 		if (err) {
// 			res.send(err);
// 		}
// 		else {
// 			res.send(docs);
// 		}
// 	});
// });


ProfileRouter.route('/api/Profiles')
    .get(function(req,res){

		Profile.find(function(err, profiles){
			if(err) res.status(404).send("Error finding profiles");
			res.send(profiles);
		})

	});



app.get('/api/timelogs', function (req, res) {
	Timelog.find({}, function (err, docs) {
		if (err) {
			res.send(err);
		}
		else {
			res.send(docs);
		}
	});
});

app.get('/api/users', function (req, res) {
	user.find({}, function (err, docs) {
		if (err) {
			res.send(err);
		}
		else {
			res.send(docs);
		}
	});
});


var MongoClient = require('mongodb').MongoClient;
var url = 'mongodb://localhost/hgnData';

app.get('/api/dashboard', function (req, res) {
	dashboard.getdahsboardData(function (items) {
		res.json(items[0]);
	});
})






app.all('*', function (req, res, next) {
	console.log('Error 404', req.url);
	return res.status(404).json({ success: false, message: 'Route \'' + req.url + '\' is invalid.' });
});
app.use(function (err, req, res, next) {
	console.log('Error 500');
	return res.status(500).json(err);
});






app.listen('4500');
