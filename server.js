var express = require('express');
var mongoose = require('mongoose');
var cors = require('cors');
let jwt = require('jsonwebtoken');
let config = require('./config');
let moment = require('moment');
let http = require('http');
require('dotenv').load();


//Define models here
var timeEntry = require('./models/timeentry');
var userProfile = require('./models/userProfile');
var project = require('./models/project');
var team = require('./models/team');
var actionItem = require('./models/actionItem');
var notification = require('./models/notification');

//Define routers here
var userProfileRouter = require('./routes/userProfileRouter')(userProfile);
var dashboardRouter = require('./routes/dashboardRouter')(timeEntry, userProfile);
var timeEntryRouter = require('./routes/timeentryRouter')(timeEntry);
var projectRouter = require('./routes/projectRouter')(project);
var teamRouter = require('./routes/teamRouter')(team);
var actionItemRouter = require('./routes/actionItemRouter')(actionItem);
var notificationRouter = require('./routes/notificationRouter')(notification);
var loginRouter = require('./routes/loginRouter')();
var forgotPwdRouter = require('./routes/forgotPwdRouter')(userProfile);
var forcePwdRouter = require('./routes/forcePwdRouter')(userProfile);

var bodyParser = require('body-parser');
mongoose.Promise = Promise;

//Call jobs

var j = require('./cronjobs/assignBlueBadge')(userProfile);


var app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

var url = (process.env.url) ? (process.env.url.toString()) : "";
const options =
	{
		autoReconnect: true,
		reconnectTries: Number.MAX_VALUE,
		authSource: process.env.authSource,
		user: process.env.user,
		pass: process.env.password,

	}
	var uri = 'mongodb://hgnData:Test123@cluster0-shard-00-00-gl12q.mongodb.net:27017/hgnData?ssl=true&replicaSet=Cluster0-shard-0&authSource=admin';
//var uri = `mongodb://${process.env.user}:${encodeURIComponent(process.env.password)}@${process.env.cluster}/${process.env.dbName}?ssl=true&replicaSet=${process.env.replicaSetName}&authSource=admin`

var db = mongoose.connect(uri).catch((error) => { console.log(error); });

app.all('*', function (req, res, next) {

	console.log(` Service called Url: ${req.originalUrl}, Method : ${req.method}`);

	if (req.originalUrl == "/") {
		res.status(200).send("This is the homepage for rest services");
		return;
	}

	if ((req.originalUrl == "/api/login" || req.originalUrl == "/api/forgotpassword" ) && req.method == "POST") { next(); return; }
	if(req.originalUrl == "/api/forcepassword" && req.method == "PATCH" ){next(); return;}
	if (!req.header("Authorization")) {
		res.status(401).send({ "error:": "Unauthorized request" });
		return;
	}

	let authToken = req.header(config.REQUEST_AUTHKEY);

	let payload = "";

	try {
		payload = jwt.verify(authToken, config.JWT_SECRET);

	}
	catch (error) {
		res.status(401).send("Invalid token");
		return;

	}

	if (!payload || !payload.expiryTimestamp || !payload.userid || !payload.role ||
		moment().isAfter(payload.expiryTimestamp)) {
		res.status(401).send("Unauthorized request");
		return;
	}

	let requestor = {};
	requestor.requestorId = payload.userid;
	requestor.role = payload.role;
	req.body.requestor = requestor;
	next();
});


app.use('/api', forgotPwdRouter);
app.use('/api', loginRouter);
app.use('/api', forcePwdRouter);
app.use('/api', projectRouter);
app.use('/api', userProfileRouter);
app.use('/api', dashboardRouter);
app.use('/api', timeEntryRouter);
app.use('/api', teamRouter);
app.use('/api', actionItemRouter);
app.use('/api', notificationRouter);


var port = normalizePort(process.env.PORT || '4500');
app.set('port', port);

var server = http.createServer(app);
server.listen(port)


app.get('/api/', function (req, res) {
	res.send('Success');
});


app.use(function (err, req, res, next) {
	console.log(err);
	return res.status(500).json(err);
});
function normalizePort(val) {
	var port = parseInt(val, 10);

	if (isNaN(port)) {
		// named pipe
		return val;
	}

	if (port >= 0) {
		// port number
		return port;
	}

	return false;
}
