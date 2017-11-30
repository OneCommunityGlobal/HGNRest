var express = require('express');
var mongoose = require('mongoose');
var Profile = require('./models/profile');
var TimeLog = require('./models/timelog');
var bodyParser = require('body-parser')

var app = express();
app.use(bodyParser.json());       
app.use(bodyParser.urlencoded({extended: true}));

var db = mongoose.connect('mongodb://localhost/hgnData');

var ProfileRouter = require('./routes/profileRoutes')(Profile);
var TimeLogRouter = require('./routes/timelogRoutes')(TimeLog);

app.use('/api',TimeLogRouter);
app.use('/api', ProfileRouter);




app.listen('4500');

