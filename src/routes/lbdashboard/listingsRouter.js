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
  const listingHomeRouter = express.Router();
  const controller = require('../../controllers/lbdashboard/listingsController')(ListingHome);

  listingHomeRouter.route('/listings').get(controller.getListings);
  listingHomeRouter.route('/listings').post(upload.array('images', 10), controller.createListing);
  
  listingHomeRouter.route('/biddings').get(controller.getBiddings);
  
  listingHomeRouter.route('/villages').get(controller.getVillages);
  
  listingHomeRouter.route('/getListings').get(controller.getListings);
  listingHomeRouter.route('/createListing').post(upload.array('images', 10), controller.createListing);

  return listingHomeRouter;
};

module.exports = routes;
