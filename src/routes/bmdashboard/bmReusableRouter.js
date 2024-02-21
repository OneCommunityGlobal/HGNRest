const express = require('express');

const routes = function (BuildingReusable) {
  const BuildingReusableController = express.Router();
  const controller = require('../../controllers/bmdashboard/bmReusableController')(BuildingReusable);

  BuildingReusableController.route('/reusables')
    .get(controller.fetchBMReusables)

  BuildingReusableController.route('/reusables/purchase')
    .post(controller.purchaseReusable);

  //TODO(Yan): Double check with manager(auth issue)
  BuildingReusableController.route('/reusables/:id')
    .delete(controller.deleteReusable);

  BuildingReusableController.route('/reusables/add')
    .post(controller.addReusable);

  //TODO(Yan): Delete following line/func after Dev
  BuildingReusableController.route('/reusables/seedItem')
    .get(controller.SeedReusableItems);

  return BuildingReusableController;
};

module.exports = routes;
