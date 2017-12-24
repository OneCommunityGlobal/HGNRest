var express = require('express');
var mongoose = require('mongoose');
var cors = require('cors');


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
var dashboard = require('./dashboard');
mongoose.Promise = Promise;


var app = express();
app.use(cors());
app.use(bodyParser.json());       
app.use(bodyParser.urlencoded({extended: true}));


var uri = 'mongodb://hgnData:Test123@cluster0-shard-00-00-gl12q.mongodb.net:27017/hgnData?ssl=true&replicaSet=Cluster0-shard-0&authSource=admin';

//var uri = 'localhost:27017/hgnData';


var db = mongoose.connect(uri, {useMongoClient : true});



app.use('/api',projectRouter);
app.use('/api', userProfileRouter);
app.use('/api', dashboardRouter);
app.use('/api', timeEntryRouter);
app.use('/api', teamRouter);
app.use('/api', loginRouter);




app.listen('4500');


app.get('/api/dashboard', function (req, res) {
	dashboard.getdahsboardData(function (items) {
		res.json(items[0]);
	});
});




app.post('/api/token', function (req, res) {
	console.log(req.body);
	if (req.body.username === 'test' && req.body.password === 'test') {
		res.send({ access_token: "12345" });
	}
});

app.get('/api/', function (req, res) {
	res.send('Success');
});

app.all('*', function (req, res, next) {
	console.log('Error 404', req.url);
	return res.status(404).json({ success: false, message: 'Route \'' + req.url + '\' is invalid.' });
});
app.use(function (err, req, res, next) {
	console.log('Error 500');
	return res.status(500).json(err);
});

