const express = require('express');

const routes = function (TimeEntry) {
  const TimeEntryRouter = express.Router();

  const controller = require('../controllers/timeEntryController')(TimeEntry);

  TimeEntryRouter.route('/TimeEntry').post(controller.postTimeEntry);

  TimeEntryRouter.route('/TimeEntry/:timeEntryId')
    .put(controller.editTimeEntry)
    .delete(controller.deleteTimeEntry);

  TimeEntryRouter.route('/TimeEntry/user/:userId/:fromdate/:todate').get(
    controller.getTimeEntriesForSpecifiedPeriod,
  );

  TimeEntryRouter.route('/TimeEntry/users').post(controller.getTimeEntriesForUsersList);

  TimeEntryRouter.route('/TimeEntry/reports').post(controller.getTimeEntriesForReports);

  TimeEntryRouter.route('/TimeEntry/lostUsers').post(controller.getLostTimeEntriesForUserList);

  TimeEntryRouter.route('/TimeEntry/lostProjects').post(
    controller.getLostTimeEntriesForProjectList,
  );

  TimeEntryRouter.route('/TimeEntry/lostTeams').post(controller.getLostTimeEntriesForTeamList);

  TimeEntryRouter.route('/TimeEntry/projects/:projectId/:fromDate/:toDate').get(
    controller.getTimeEntriesForSpecifiedProject,
  );

  TimeEntryRouter.route('/TimeEntry/recalculateHoursAllUsers').post(
    controller.recalculateHoursByCategoryAllUsers,
  );

  TimeEntryRouter.route('/TimeEntry/recalculateHoursOneUser').post(
    controller.recalculateHoursByCategoryOneUser,
  );

  TimeEntryRouter.route('/TimeEntry/backupHoursByCategoryAllUsers').post(
    controller.backupHoursByCategoryAllUsers,
  );

  return TimeEntryRouter;
};

module.exports = routes;
