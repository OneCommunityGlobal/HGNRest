const express = require('express');
const multer = require('multer');

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

const routes = function (ListingHome) {
  const listingRouter = express.Router();
  const controller = require('../../controllers/lbdashboard/listingsController')(ListingHome);

  listingRouter.route('/listings')
    .get(controller.getListings)
    .post(upload.array('images', 10), controller.createListing);

  listingRouter.route('/listings/id')
    .get(controller.getListingById)
    .put(upload.array('images', 10), controller.updateListing)
    .delete(controller.deleteListing);

  // Additional endpoints
  listingRouter.route('/biddings').get(controller.getBiddings);
  listingRouter.route('/villages').get(controller.getVillages);

  return listingHomeRouter;
};

module.exports = routes;