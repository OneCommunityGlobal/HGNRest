const express = require('express');
const BidDeadlines = require('../../models/lbdashboard/bidDeadline');
const bidDeadlinesController = require('../../controllers/lbdashboard/bidDeadlinesController')(
  BidDeadlines,
);

const bidDeadlinesRouter = express.Router();
bidDeadlinesRouter
  .route('/bidDeadlines')
  .get(bidDeadlinesController.getBidDeadlines)
  .post(bidDeadlinesController.postBidDeadlines);

module.exports = bidDeadlinesRouter;
