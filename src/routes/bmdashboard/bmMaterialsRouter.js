const express = require('express');

const routes = function (itemMaterial, itemType) {
  const materialsRouter = express.Router();
  const controller = require('../../controllers/bmdashboard/bmMaterialsController')(itemMaterial, itemType);

  materialsRouter.route('/materials')
    .get(controller.bmMaterialsList)
    .post(controller.bmAddMaterials);

  return materialsRouter;
};

module.exports = routes;
