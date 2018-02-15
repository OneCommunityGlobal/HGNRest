var express = require('express');

var routes = function(TimeEntry){

var TimeEntryRouter = express.Router();

var controller = require('../controllers/timeEntryController')(TimeEntry);

TimeEntryRouter.route('/TimeEntry')
.get(controller.getAllTimeEnteries)
.post(controller.postTimeEntry);

TimeEntryRouter.route('/TimeEntry/user/projects/:userId')
.get(controller.getUserProjects)

return TimeEntryRouter;
}

module.exports = routes;


