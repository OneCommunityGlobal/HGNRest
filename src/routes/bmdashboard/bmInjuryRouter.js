const express = require('express');

const routes = function (injurySeverity) {
  const InjuryRouter = express.Router();
  const controller = require('../../controllers/bmdashboard/bmInjuryController')(injurySeverity);

  InjuryRouter.route('/injuries').post(controller.postInjury);
  InjuryRouter.route('/injuries/severity-by-project').get(controller.getInjuries);

  return InjuryRouter;
};
module.exports = routes;
