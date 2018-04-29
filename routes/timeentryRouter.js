var express = require('express');

var routes = function (TimeEntry) {

    var TimeEntryRouter = express.Router();

    var controller = require('../controllers/timeEntryController')(TimeEntry);
    //var testcontroller = require('../controllers/test')(TimeEntry);
    TimeEntryRouter.route('/TimeEntry')
        .get(controller.getAllTimeEnteries)
        .post(controller.postTimeEntry)

    TimeEntryRouter.route('/TimeEntry/:timeEntryId')
        .put(controller.editTimeEntry)
        .delete(controller.deleteTimeEntry)

    TimeEntryRouter.route('/TimeEntry/user/projects/:userId')
        .get(controller.getUserProjects)

    TimeEntryRouter.route('/TimeEntry/user/:userId/:fromdate/:todate')
        .get(controller.getTimeEntriesForSpecifiedPeriod)
//Route to get time entries for a specific project for a specific period of time
    TimeEntryRouter.route('/TimeEntry/projects/:projectId/:fromDate/:toDate')
        .get(controller.getTimeEntriesForSpecifiedProject)


    return TimeEntryRouter;
}

module.exports = routes;
