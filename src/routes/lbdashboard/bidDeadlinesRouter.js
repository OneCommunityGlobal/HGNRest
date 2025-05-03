const express = require('express');
const BidDeadlines = require('../../models/lbdashboard/bidDeadline');
const bidDeadlinesController = require('../../controllers/lbdashboard/bidDeadlinesController')(
  BidDeadlines,
);

const bidDeadlinesRouter = express.Router();
console.log('bidDeadlinesRouter');
bidDeadlinesRouter
  .route('/bidDeadlines')
  .get(bidDeadlinesController.getBidDeadlines)
  .post(bidDeadlinesController.postBidDeadlines);

module.exports = bidDeadlinesRouter;
