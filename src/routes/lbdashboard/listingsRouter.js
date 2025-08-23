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

  listingRouter.route('/listing')
    .get(controller.getListings)
    .post(upload.array('images', 10), controller.createListing);

  listingRouter.post('/listing/getById', controller.getListingById);

  // Additional endpoints
  listingRouter.route('/biddings').get(controller.getBiddings);
  listingRouter.route('/villages').get(controller.getVillages);

  return listingRouter;
};

module.exports = routes;