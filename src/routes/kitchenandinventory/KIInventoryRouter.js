const express = require('express');
const controller = require('../../controllers/kitchenandinventory/KIInventoryController')();

const router = function () {
  const inventoryRouter = express.Router();

  inventoryRouter.route('/items').post(controller.addItem);
  return inventoryRouter;
};

module.exports = router;
