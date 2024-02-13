const express = require('express');

// TDOD(Yan): delete the ReusableType obj
const routes = function (BuildingReusable, ReusableType) {
  const BuildingReusableController = express.Router();
  // TDOD(Yan): delete the ReusableType obj
  const controller = require('../../controllers/bmdashboard/bmReusableController')(BuildingReusable, ReusableType);

  BuildingReusableController.route('/reusables')
    .get(controller.fetchBMReusables);

  // TDOD(Yan): delete '/reusables/seed' and '/reusables/deleteAllSeed' route
  BuildingReusableController.route('/reusables/seed')
    .post(controller.seed);

  BuildingReusableController.route('/reusables/all')
    .delete(controller.cleanupReusableItems);

  BuildingReusableController.route('/reusables/:id')
    .delete(controller.deleteReusable);

  return BuildingReusableController;
};

module.exports = routes;
