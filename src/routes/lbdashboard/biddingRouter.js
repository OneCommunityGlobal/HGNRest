const express = require('express');
const multer = require('multer');
const BiddingHome = require('../../models/lbdashboard/biddings');

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

const routes = function () {
  const biddingRouter = express.Router();
  const controller = require('../../controllers/lbdashboard/biddingController')(BiddingHome);

  biddingRouter.get('/biddings', controller.getBidListings);
  biddingRouter.get('/bidding/id', controller.getBidListingById);
  biddingRouter.post('/bidding', upload.array('images', 10), controller.createBidListing);
  biddingRouter.put('/bidding', upload.array('images', 10), controller.updateBidListing);
  biddingRouter.delete('/bidding', controller.deleteBidListing);

  return biddingRouter;
};

module.exports = routes;