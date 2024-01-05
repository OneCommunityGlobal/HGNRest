const express = require('express');

const routes = function (itemMaterial, buildingMaterial) {
  const materialsRouter = express.Router();
  const controller = require('../../controllers/bmdashboard/bmMaterialsController')(itemMaterial, buildingMaterial);
  materialsRouter.route('/materials')
    .get(controller.bmMaterialsList)
    .post(controller.bmPurchaseMaterials);

  materialsRouter.route('/updateMaterialRecord')
    .post(controller.bmPostMaterialUpdateRecord);

  materialsRouter.route('/updateMaterialRecordBulk')
    .post(controller.bmPostMaterialUpdateBulk);


  return materialsRouter;
};

module.exports = routes;
