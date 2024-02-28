const express = require('express');

const routes = function (BuildingReusable) {
  const BuildingReusableController = express.Router();
  const controller = require('../../controllers/bmdashboard/bmReusableController')(BuildingReusable);

  BuildingReusableController.route('/reusables')
    .get(controller.fetchBMReusables);

  return BuildingReusableController;
};

module.exports = routes;
