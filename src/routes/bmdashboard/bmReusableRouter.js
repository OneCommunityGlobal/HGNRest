const express = require('express');

const routes = function (BuildingReusable) {
  const BuildingReusableController = express.Router();
  const controller = require('../../controllers/bmdashboard/bmReusableController')(BuildingReusable);

  BuildingReusableController.route('/reusables')
    .get(controller.fetchBMReusables);

  BuildingReusableController.route('/reusables/:id')
    .delete(controller.deleteReusable);
  return BuildingReusableController;
};

module.exports = routes;
