const express = require('express');

const routes = function (buildingReusable) {
  const reusablesRouter = express.Router();
  const controller = require('../../controllers/bmdashboard/bmReusablesController')(buildingReusable);
  reusablesRouter.route('/reusables')
    .get(controller.bmReusablesList)
    .post(controller.bmPurchaseReusables);

  reusablesRouter.route('/updateReusableRecord')
    .post(controller.bmPostReusableUpdateRecord);

  reusablesRouter.route('/updateReusableRecordBulk')
    .post(controller.bmPostReusableUpdateBulk);

  return reusablesRouter;
};

module.exports = routes;
