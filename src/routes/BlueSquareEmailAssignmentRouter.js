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

  return BlueSquareEmailAssignmentRouter;
};

module.exports = routes;
