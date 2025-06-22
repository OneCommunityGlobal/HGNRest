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

  biddingRouter.get('/biddings', controller.getBiddings);
  biddingRouter.get('/bidding/id', controller.getListingById);
  biddingRouter.post('/bidding', upload.array('images', 10), controller.createListing);
  biddingRouter.put('/bidding', upload.array('images', 10), controller.updateListing);
  biddingRouter.delete('/bidding', controller.deleteListing);

  return biddingRouter;
};

module.exports = routes;