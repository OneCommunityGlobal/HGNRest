var express = require('express');
var mongoose = require('mongoose');

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

var profile = new mongoose.Schema({
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

/*
Sample Mongo DB entry 
	{
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
    }
*/

var noteSchema = new mongoose.Schema({
	title: 'string',
	content: 'string',
	author: 'string'
});

var NoteModel = mongoose.model('profile',profile);
app.get('/api/',function(req,res) {
	res.send('Working');
});

app.get('/api/profiles', function(req,res) {
	NoteModel.find({},function(err,docs) {
		if(err) {
			res.send(err);
		}
		else {
			res.send(docs);
		}
	});
});

app.listen('4500');
