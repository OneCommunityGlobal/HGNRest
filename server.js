var express = require('express');
var mongoose = require('mongoose');
var {Schema} = mongoose;

var app = express();

//Initial Configuration for the Server.
app.use(function(req, res, next) {
	// For testing purpose I'm Commenting the below line, but later somepoint we can just make sure to allow traffic only from particular port.
	res.setHeader('Access-Control-Allow-Origin', 'http://localhost:4200');
	res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  	res.header('Access-Control-Allow-Methods', 'POST, GET, PUT, DELETE, OPTIONS');
    	next();
});

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
	avatar:String,
	estimated_tenure: {type : Date, default : Date.now},
	created: {type : Date, default : Date.now},
});


var timelogSchema = new Schema({
	//profile: { type: Schema.Types.ObjectID, ref: 'profiles' },
  date: {type : Date, default : Date.now},
  startTime: Date,
  endTime: Date,
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

app.get('/api/',function(req,res) {
	res.send('Working');
});

app.get('/api/profiles', function(req,res) {
	Profile.find({},function(err,docs) {
		if(err) {
			res.send(err);
		}
		else {
			res.send(docs);
		}
	});
});

app.get('/api/timelogs', function(req,res) {
	Timelog.find({},function(err,docs) {
		if(err) {
			res.send(err);
		}
		else {
			res.send(docs);
		}
	});
});

app.get('/api/users', function(req,res) {
	user.find({},function(err,docs) {
		if(err) {
			res.send(err);
		}
		else {
			res.send(docs);
		}
	});
});
app.get('api/timelog', function(req, res){
	console.log('timelog get: ', res.body)
})


function insertDummyData() {
	const errFunc = (collectionName) => { return (err) => {if (err) throw err; else console.log(`${collectionName} inserted...`)} }

	Timelog.find({}, function(err, docs) {

		if (err) {
			console.log(err)
		}
		else {
			if (docs && docs.length == 0) {
				let t = new Timelog({
					date: '2017-04-06',
					startTime: '2017-04-06 12:00:00',
					endTime: '2017-04-06 13:00:00',
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

	Profile.find({}, function(err, docs) {
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
			        "avatar":"",
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


app.listen('4500');
