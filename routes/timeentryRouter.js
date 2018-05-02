var express = require('express');

var routes = function (TimeEntry) {

    var TimeEntryRouter = express.Router();

    var controller = require('../controllers/timeEntryController')(TimeEntry);

    TimeEntryRouter.route('/TimeEntry')
        .get(controller.getAllTimeEnteries)
        .post(controller.postTimeEntry)

    TimeEntryRouter.route('/TimeEntry/:timeEntryId')
        .put(controller.editTimeEntry)
        .delete(controller.deleteTimeEntry)

    TimeEntryRouter.route('/TimeEntry/user/:userId/:fromdate/:todate')
        .get(controller.getTimeEntriesForSpecifiedPeriod)

    TimeEntryRouter.route('/TimeEntry/projects/:projectId/:fromDate/:toDate')
            .get(controller.getTimeEntriesForSpecifiedProject)


    return TimeEntryRouter;
}

module.exports = routes;
