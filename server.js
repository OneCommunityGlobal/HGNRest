var express = require('express');
var mongoose = require('mongoose');
var cors = require('cors');
let jwt = require('jsonwebtoken');
let config = require('./config');
let moment = require('moment');


//Define models here
var timeEntry = require('./models/timeentry');
var userProfile = require('./models/userProfile');
var project = require('./models/project');
var team = require('./models/team');


//Define routers here
var userProfileRouter = require('./routes/userProfileRouter')(userProfile);
var dashboardRouter = require('./routes/dashboardRouter')(timeEntry, userProfile);
var timeEntryRouter = require('./routes/timeentryRouter')(timeEntry);
var projectRouter = require('./routes/projectRouter')(project);
var teamRouter = require('./routes/teamRouter')(team);
var loginRouter = require('./routes/loginRouter')();


var bodyParser = require('body-parser');
mongoose.Promise = Promise;


var app = express();
app.use(cors());
app.use(bodyParser.json());       
app.use(bodyParser.urlencoded({extended: true}));


var uri = 'mongodb://hgnData:Test123@cluster0-shard-00-00-gl12q.mongodb.net:27017/hgnData?ssl=true&replicaSet=Cluster0-shard-0&authSource=admin';

//var uri = 'mongodb://localhost:27017/hgnData';


var db = mongoose.connect(uri).catch((error) => {console.log(error);});

app.all('*', function (req, res, next) {

	console.log(` Service called Url: ${req.originalUrl}, Method : ${req.method}`);
 
	if(req.originalUrl == "/api/login" && req.method == "POST") {next(); return;}
	
	if(!req.header("Authorization"))
	{
		res.status(401).send("Unauthorized request");
		return;
	}

	let authToken = req.header(config.REQUEST_AUTHKEY);

	let payload = "";

	try{
		payload = jwt.verify(authToken, config.JWT_SECRET);
		
	}
	catch(error)
	{
		res.status(401).send("Invalid token");
		return;

	}
		 
	if(!payload || !payload.expiryTimestamp || !payload.userid || !payload.role || 
		moment().isAfter(payload.expiryTimestamp))
	{
		res.status(401).send("Unauthorized request");
		return;
	}
	
	let requestor = {};
	requestor.requestorId = payload.userid;
	requestor.role = payload.role;
	
	req.body.requestor = requestor;

	next();


});



app.use('/api',projectRouter);
app.use('/api', userProfileRouter);
app.use('/api', dashboardRouter);
app.use('/api', timeEntryRouter);
app.use('/api', teamRouter);
app.use('/api', loginRouter);




app.listen('4500');

app.get('/api/', function (req, res) {
	res.send('Success');
});


app.use(function (err, req, res, next) {
	console.log('Error 500');
	return res.status(500).json(err);
});

