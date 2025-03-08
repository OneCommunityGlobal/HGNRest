const express = require('express');
const Bids = require('../../models/lbdashboard/bids');
const bidsController = require('../../controllers/lbdashboard/bidsController')(Bids);

const bidsRouter = express.Router();

bidsRouter.route('/bids').get(bidsController.getBids).post(bidsController.postBids);
// .get(bidsController.getPaymentCardToken);

bidsRouter.route('/bids/getPaymentCardToken/').get(bidsController.getPaymentCardToken);

module.exports = bidsRouter;
