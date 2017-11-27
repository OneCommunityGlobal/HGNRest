var express = require('express');
var mongoose = require('mongoose');
var { Schema } = mongoose;
var dashboard = require('./dashboard');

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

var bodyParser = require('body-parser')

app.use(bodyParser.json());       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
	extended: true
}));
// Connects to local Database, if the database is not present creates one for us.
mongoose.connect('mongodb://localhost/hgnData');
mongoose.set('debug', true);


var profileSchema = new Schema({
	name: String,
	phone: String,
	email: String,
	about: String,
	linkedin: String,
	facebook: String,
	comitted_hours: Number,
	avatar: String,
	estimated_tenure: { type: Date, default: Date.now },
	created: { type: Date, default: Date.now },
});


var timelogSchema = new Schema({
	//profile: { type: Schema.Types.ObjectID, ref: 'profile' },
	createDate: { type: Date, default: Date.now },
	lastModifyDate: { type: Date, default: Date.now },
	totalSeconds: Number,
	tangible: Boolean,
	workCompleted: String,
	project: String,
	task: String
});

//sow:Added for UserManagement
var userSchema = new Schema({
	userName: String,
	firstName: String,
	lastName: String,
	email: String,
	contact: String,
	role: String,
});

var Profile = mongoose.model('profile', profileSchema);
var Timelog = mongoose.model('timelog', timelogSchema);
var user = mongoose.model('user', userSchema);







insertDummyData();

app.post('/api/token', function (req, res) {
	console.log(req.body)
	if (req.body.username === 'test' && req.body.password === 'test') {
		res.send({ access_token: "12345" });
	}
});

app.get('/api/', function (req, res) {
	res.send('Success');
});

app.get('/api/profiles', function (req, res) {
	Profile.find({}, function (err, docs) {
		if (err) {
			res.send(err);
		}
		else {
			res.send(docs);
		}
	});
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
app.get('api/timelog', function (req, res) {
	console.log('timelog get: ', res.body)
})

app.post('/api/timelogs', function (req, res) {
	console.log('timelogs POST... ', req.body)

	let t = new Timelog(req.body)
	t.save((err) => {
		if (err) {
			console.log('Timelogs POST error ', err);
			res.send(err)
		} else {
			res.send('ok')
		}
	})

})

var MongoClient = require('mongodb').MongoClient;
var url = 'mongodb://localhost/hgnData';

app.get('/api/dashboard', function (req, res) {
	dashboard.getdahsboardData(function (items) {
		res.json(items[0]);
	});
})



function insertDummyData() {
	const errFunc = (collectionName) => { return (err) => { if (err) throw err; else console.log(`${collectionName} inserted...`) } }

	Timelog.find({}, function (err, docs) {

		if (err) {
			console.log(err)
		}
		else {
			if (docs && docs.length == 0) {
				let t = new Timelog({
					createDate: '2017-04-06',
					lastModifyDate: '2017-05-06',
					totalSeconds: 60 * 60,
					tangile: true,
					workCompleted: 'Working on really great things.',
					project: 'hgn',
					task: 'Models for Mongo.'
				})
				t.save(errFunc('timelog'))
			}
		}
	})

	Profile.find({}, function (err, docs) {
		if (err) {
			console.log(err)
		}
		else {
			if (docs && docs.length == 0) {
				let p = new Profile({
					"_id": "58f91d30b4c403d02cddd23d",
					"about": "A moment of Silence!",
					"comitted_hours": "22",
					"created": "2017-04-20T23:03:36.778Z",
					"email": "anil.amf237@gmail.com",
					"estimated_tenure": "2017-04-20T23:03:36.778Z",
					"avatar": "",
					"facebook": "https://www.linkedin.com/in/ak-malla",
					"linkedin": "https://www.linkedin.com/in/ak-malla",
					"name": "Anil Kumar, Malla",
					"phone": "9999999999"
				})

				p.save(errFunc('profile'))
			}
		}
	})
}


app.all('*', function (req, res, next) {
	console.log('Error 404', req.url);
	return res.status(404).json({ success: false, message: 'Route \'' + req.url + '\' is invalid.' });
});
app.use(function (err, req, res, next) {
	console.log('Error 500');
	return res.status(500).json(err);
});






app.listen('4500');
