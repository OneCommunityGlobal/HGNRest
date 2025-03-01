const express = require('express');
const BidTerms = require('../../models/lbdashboard/bidTerms');
const bidTermsController = require('../../controllers/lbdashboard/bidTermsController')(BidTerms);

const bidTermsRouter = express.Router();

bidTermsRouter.route('/bidTerms').get(bidTermsController.getBidTerms);

module.exports = bidTermsRouter;
