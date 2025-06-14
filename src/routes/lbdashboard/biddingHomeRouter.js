const express = require('express');
const multer = require('multer');
const BiddingHome = require('../../models/lbdashboard/biddingHome');
const controller = require('../../controllers/lbdashboard/biddingHomeController')(BiddingHome);

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

const routes = function () {
  const biddingRouter = express.Router();

  biddingRouter.get('/lbdashboard/biddinghome', controller.getBiddings);
  biddingRouter.get('/lbdashboard/biddinghome/id', controller.getListingById);
  biddingRouter.post('/lbdashboard/biddinghome', upload.array('images', 10), controller.createListing);
  biddingRouter.put('/lbdashboard/biddinghome', upload.array('images', 10), controller.updateListing);
  biddingRouter.delete('/lbdashboard/biddinghome', controller.deleteListing);

  return biddingRouter;
};

module.exports = routes;