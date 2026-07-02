const express = require('express');
const BidTerms = require('../../models/lbdashboard/bidTerms');
const bidTermsController = require('../../controllers/lbdashboard/bidTermsController')(BidTerms);

const bidTermsRouter = express.Router();

bidTermsRouter
  .route('/bidTerms')
  .get(bidTermsController.getBidTerms)
  .post(bidTermsController.postBidTerms);

bidTermsRouter.route('/bidTerms/:id').delete(bidTermsController.deleteBidTerms);

bidTermsRouter.route('/bidTerms/inactive/:id').put(bidTermsController.inactiveBidTerms);

module.exports = bidTermsRouter;
