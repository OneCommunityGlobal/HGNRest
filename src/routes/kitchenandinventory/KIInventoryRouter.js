const express = require('express');
const controller = require('../../controllers/kitchenandinventory/KIInventoryController')();

const router = function () {
  const inventoryRouter = express.Router();

  // ── Specific named routes (must come before /:category wildcard) ──────────
  inventoryRouter.route('/items').get(controller.getItems); // Get all inventory items
  inventoryRouter.route('/items').post(controller.addItem); // Add a new inventory item
  inventoryRouter.route('/items/stats').get(controller.getInventoryStats); // Get total, critical & low stock counts
  inventoryRouter.route('/items/ingredients/preserved').get(controller.getPreservedStock); // Get preserved items (expiry >= 1 yr)

  // ── Update endpoints (non-idempotent, specific actions) ───────────────────
  inventoryRouter.route('/items/usage').post(controller.updateOnUsage); // Update item on usage
  inventoryRouter.route('/items/storedQuantity').post(controller.updateStoredQuantity); // Add new stock
  inventoryRouter.route('/items/nextHarvest').put(controller.updateNextHarvest); // Update next harvest details

  // ── Wildcard route (must be last to avoid shadowing named routes above) ───
  inventoryRouter.route('/items/:category').get(controller.getItemsByCategory); // Get items by category

  return inventoryRouter;
};

module.exports = router;

