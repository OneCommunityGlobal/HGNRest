const express = require('express');

const routes = function (ListingHome) {
  const listingHomeRouter = express.Router();
  const controller = require('../../controllers/lbdashboard/listingsController')(ListingHome);

  listingHomeRouter.route('/getListings').get(controller.getListings);


  return listingHomeRouter;
};

module.exports = routes;