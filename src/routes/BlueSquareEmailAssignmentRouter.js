const express = require('express');

const routes = function (BlueSquareEmailAssignment, userProfile) {
  const BlueSquareEmailAssignmentRouter = express.Router();
  const controller = require('../controllers/BlueSquareEmailAssignmentController')(
    BlueSquareEmailAssignment,
    userProfile,
  );

  BlueSquareEmailAssignmentRouter.route('/AssignBlueSquareEmail')
    .get(controller.getBlueSquareEmailAssignment)
    .post(controller.setBlueSquareEmailAssignment);

  BlueSquareEmailAssignmentRouter.route('/AssignBlueSquareEmail/:id').delete(
    controller.deleteBlueSquareEmailAssignment,
  );

  BlueSquareEmailAssignmentRouter.post(
    '/blueSquare/resend-weekly-summary-emails',
    controller.runManuallyResendWeeklySummaries,
  );

  BlueSquareEmailAssignmentRouter.post(
    '/blueSquare/resend-infringement-emails-only',
    controller.runManualBlueSquareEmailResend,
  );

  return BlueSquareEmailAssignmentRouter;
};

module.exports = routes;
