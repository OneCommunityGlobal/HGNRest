var express = require('express');
var timeEntry = require('../models/timeentry');
var userProfile = require('../models/userProfile');
var project = require('../models/project');
var team = require('../models/team');
var actionItem = require('../models/actionItem');
var notification = require('../models/notification');


var userProfileRouter = require('../routes/userProfileRouter')(userProfile);
var dashboardRouter = require('../routes/dashboardRouter')(timeEntry, userProfile);
var timeEntryRouter = require('../routes/timeentryRouter')(timeEntry);
var projectRouter = require('../routes/projectRouter')(project);
var teamRouter = require('../routes/teamRouter')(team);
var actionItemRouter = require('../routes/actionItemRouter')(actionItem);
var notificationRouter = require('../routes/notificationRouter')(notification);
var loginRouter = require('../routes/loginRouter')();
var forgotPwdRouter = require('../routes/forgotPwdRouter')(userProfile);
var forcePwdRouter = require('../routes/forcePwdRouter')(userProfile);

module.exports = function(app)
{
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
}