const express = require('express');

const routes = function (BuildingReusable) {
  const BuildingReusableController = express.Router();
  const controller = require('../../controllers/bmdashboard/bmReusableController')(BuildingReusable);

  BuildingReusableController.route('/reusables')
    .get(controller.fetchBMReusables);

  BuildingReusableController.route('/reusables/purchase')
    .post(controller.purchaseReusable);

  BuildingReusableController.route('/updateReusableRecord')
    .post(controller.bmPostReusableUpdateRecord);

  BuildingReusableController.route('/updateReusableRecordBulk')
    .post(controller.bmPostReusableUpdateBulk);

  return BuildingReusableController;
};

module.exports = routes;
