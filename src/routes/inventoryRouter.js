const express = require('express');

const routes = function (item, itemType, projects) {
  const controller = require('../controllers/inventoryController')(item, itemType, projects);

  const inventoryRouter = express.Router();

  inventoryRouter.route('/invtype').get(controller.getAllInvType).post(controller.postInvType);

  inventoryRouter
    .route('/invtype/:typeId')
    .get(controller.getInvTypeById)
    .put(controller.putInvType);

  inventoryRouter
    .route('/inv/:invId') // Single Inventory By Inv ID
    .get(controller.getInvIdInfo)
    .put(controller.putInvById);

  inventoryRouter
    .route('/invtransfer/:invId') // Transfer some or all of the inventory to another project/wbs
    .put(controller.transferInvById);

  inventoryRouter
    .route('/invwaste/:invId') // Waste some or all of the inventory
    .put(controller.unWasteInvById)
    .delete(controller.delInvById);

  inventoryRouter
    .route('/inv/:projectId') // All By Project seperated into WBS (wbs can be nill which is the unassigned category)
    .get(controller.getAllInvInProject)
    .post(controller.postInvInProject); // Can create a new inventory item in a project with unassigned wbs

  inventoryRouter
    .route('/inv/:projectId/wbs/:wbsId') // All By Project seperated into WBS (wbs can be nill which is the unassigned category)
    .get(controller.getAllInvInProjectWBS)
    .post(controller.postInvInProjectWBS); // Can create a new inventory item in a project with a specified wbs

  return inventoryRouter;
};

module.exports = routes;
