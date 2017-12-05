var express = require('express');
var mongoose = require('mongoose');
var Profile = require('./models/profile');
var TimeLog = require('./models/timelog');
var TimeEntry = require('./models/timeentry');
var bodyParser = require('body-parser');
var dashboard = require('./dashboard');


var app = express();
app.use(bodyParser.json());       
app.use(bodyParser.urlencoded({extended: true}));

var uri = 'mongodb://hgnData:Test123@cluster0-shard-00-00-gl12q.mongodb.net:27017/hgnData?ssl=true&replicaSet=Cluster0-shard-0&authSource=admin';

var db = mongoose.connect(uri);

var ProfileRouter = require('./routes/profileRoutes')(Profile);
var TimeLogRouter = require('./routes/timelogRoutes')(TimeLog);
var DashboardRouter = require('./routes/dashboardRouter')(TimeEntry, Profile);
var TimeEntryRouter = require('./routes/timeentryRoutes')(TimeEntry);

app.use('/api',TimeLogRouter);
app.use('/api', ProfileRouter);
app.use('/api', DashboardRouter);
app.use('/api', TimeEntryRouter);

app.use(function (req, res, next) {
	res.setHeader('Access-Control-Allow-Origin', 'http://localhost:4200');
	res.setHeader("Access-Control-Allow-Headers", "Content-Type, authorization");
	res.header('Access-Control-Allow-Methods', 'POST, GET, PUT, DELETE, OPTIONS');
	if ('OPTIONS' == req.method) {
		res.sendStatus(200);
	}
	else {
		next();
	}
});



app.listen('4500');


app.get('/api/dashboard', function (req, res) {
	dashboard.getdahsboardData(function (items) {
		res.json(items[0]);
	});
})




app.post('/api/token', function (req, res) {
	console.log(req.body)
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

