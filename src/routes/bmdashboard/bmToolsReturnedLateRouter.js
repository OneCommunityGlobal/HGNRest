const express = require('express');

const routes = function () {
  const router = express.Router();
  const controller = require('../../controllers/bmdashboard/bmToolsReturnedLateController')();

  router.route('/tools/returned-late').get(controller.getToolsReturnedLate);
  router.route('/tools/returned-late/projects').get(controller.getAvailableProjects);

  return router;
};

module.exports = routes;
