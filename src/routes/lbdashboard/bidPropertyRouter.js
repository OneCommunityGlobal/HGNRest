const express = require('express');

const routes = (BidProperty) => {
  const bidPropertyController = express.Router();
  const controller = require('../../controllers/lbdashboard/bidPropertyController')(
    BidProperty,
  );

  bidPropertyController.route("/properties/:propertyId").get(controller.fetchProperty);
  return bidPropertyController;
}

module.exports = routes;