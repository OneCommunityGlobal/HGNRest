const express = require('express');
const controller = require('../../controllers/kitchenandinventory/KIInventoryController')();

const router = function () {
  const inventoryRouter = express.Router();
  // Routes for inventory items
  inventoryRouter.route('/items').post(controller.addItem); // Route to add a new inventory item
  inventoryRouter.route('/items').get(controller.getItems); // Route to get all inventory items
  inventoryRouter.route('/items/:category').get(controller.getItemsByCategory); // Route to get items by category
  // Below update endpoints are non-idempotent and meant to be used for specific actions
  inventoryRouter.route('/items/updateOnUsage').post(controller.updateOnUsage); // Route to update item on usage
  inventoryRouter.route('/items/updateStoredQuantity').post(controller.updateStoredQuantity); // Route to update stored quantity
  return inventoryRouter;
};

module.exports = router;
