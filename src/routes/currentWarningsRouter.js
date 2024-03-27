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
    .route('/currentWarnings/:warningDescriptionId')
    .delete(controller.deleteWarningDescription)
    .put(controller.updateWarningDescription);
  // .put(controller.updateCurrentDescriptions)
  // .delete(controller.deleteCurrentDescriptions);

  return currentWarningsRouter;
};

module.exports = route;
