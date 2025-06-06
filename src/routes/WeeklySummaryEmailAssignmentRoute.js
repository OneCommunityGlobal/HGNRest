const express = require('express');

const routes = function (WeeklySummaryEmailAssignment, userProfile) {
  const WeeklySummaryEmailAssignmentRouter = express.Router();
  const controller = require('../controllers/WeeklySummaryEmailAssignmentController')(
    WeeklySummaryEmailAssignment,
    userProfile
  );

  WeeklySummaryEmailAssignmentRouter.route('/AssignWeeklySummaryEmail')
    .get(controller.getWeeklySummaryEmailAssignment)
    .post(controller.setWeeklySummaryEmailAssignment);

  WeeklySummaryEmailAssignmentRouter.route('/AssignWeeklySummaryEmail/:id')
    .delete(controller.deleteWeeklySummaryEmailAssignment);

  return WeeklySummaryEmailAssignmentRouter;
};

module.exports = routes;
