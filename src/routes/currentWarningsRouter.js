const express = require('express');

const route = function (currentWarnings) {
  const controller = require('../controllers/currentWarningsController')(
    currentWarnings,
  );

  const currentWarningsRouter = express.Router();

  currentWarningsRouter
    .route('/currentWarnings')
    .get(controller.getCurrentWarnings)
    .post(controller.postNewWarningDescription);

  currentWarningsRouter
    .route('/currentWarnings/edit')
    .put(controller.editWarningDescription);

  currentWarningsRouter
    .route('/currentWarnings/:warningDescriptionId')
    .delete(controller.deleteWarningDescription)
    .put(controller.updateWarningDescription);

  return currentWarningsRouter;
};

module.exports = route;
