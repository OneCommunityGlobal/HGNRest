const express = require('express');
const Bids = require('../../models/lbdashboard/bids');
const bidsController = require('../../controllers/lbdashboard/bidsController')(Bids);

const bidsRouter = express.Router();
console.log('bidsRouter');
bidsRouter.route('/bids').get(bidsController.getBids).post(bidsController.postBids);
bidsRouter.route('/getPaymentCardToken/').get(bidsController.getPaymentCardToken);

bidsRouter.route('/getPayPalAccessToken/').get(bidsController.getPayPalAccessToken);
bidsRouter.route('/createOrderWithCard').get(bidsController.createOrderWithCard);

bidsRouter.route('/createOrder').get(bidsController.createOrder);
// bidsRouter.route('/postPaymentWithCard/').get(bidsController.postPaymentWithCard);
bidsRouter.route('/bidAndPay/').post(bidsController.postBidsAndPay);
// bidsRouter.route('/postBidsAndPay/').get(bidsController.postBidsAndPay);

bidsRouter.route('/orderAuthorize/').get(bidsController.orderAuthorize);
bidsRouter.route('/orderCapture/').get(bidsController.orderCapture);

module.exports = bidsRouter;
