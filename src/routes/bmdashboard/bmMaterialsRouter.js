const express = require('express');

const routes = function (buildingMaterial) {
  const materialsRouter = express.Router();
  const controller = require('../../controllers/bmdashboard/bmMaterialsController')(buildingMaterial);
  materialsRouter.route('/materials')
    .get(controller.bmMaterialsList)
    .post(controller.bmPurchaseMaterials);

  materialsRouter.route('/updateMaterialRecord')
    .post(controller.bmPostMaterialUpdateRecord);

  materialsRouter.route('/updateMaterialRecordBulk')
    .post(controller.bmPostMaterialUpdateBulk);

    materialsRouter.route('/updateMaterialStatus')
    .post(controller.bmupdatePurchaseStatus);

  return materialsRouter;
};

module.exports = routes;
