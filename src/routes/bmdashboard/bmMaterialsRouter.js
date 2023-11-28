const express = require('express');

const routes = function (itemMaterial, buildingMaterial) {
  const materialsRouter = express.Router();
  const controller = require('../../controllers/bmdashboard/bmMaterialsController')(itemMaterial, buildingMaterial);
  materialsRouter.route('/materials')
    .get(controller.bmMaterialsList)
    .post(controller.bmPurchaseMaterials);
  return materialsRouter;
};

module.exports = routes;
