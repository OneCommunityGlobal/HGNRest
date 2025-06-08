const express = require('express');
const Bids = require('../../models/lbdashboard/bids');
const bidsController = require('../../controllers/lbdashboard/bidsController')(Bids);

const bidsRouter = express.Router();
bidsRouter.route('/bids').get(bidsController.getBids).post(bidsController.postBids);
bidsRouter.route('/getPaymentCardToken/').get(bidsController.getPaymentCardToken);

bidsRouter.route('/getPayPalAccessToken/').get(bidsController.getPayPalAccessToken);
bidsRouter.route('/createOrderWithoutCard').post(bidsController.createOrderWithoutCard);

bidsRouter.route('/createOrder').post(bidsController.createOrder);
bidsRouter.route('/bidAndPay/').post(bidsController.postBidsAndPay);
bidsRouter.route('/bidAndPayWithoutCard/').post(bidsController.postBidsAndPayWithoutCard);

bidsRouter.route('/orderAuthorize/').get(bidsController.orderAuthorize);
bidsRouter.route('/orderCapture/').post(bidsController.orderCapture);

bidsRouter.route('/orderAuthorizeWithoutCard/').get(bidsController.orderAuthorizeWithoutCard);


bidsRouter.route('/voidPayment/').post(bidsController.voidPayment);
bidsRouter.route('/updateOrder/').patch(bidsController.updateOrder);

bidsRouter.route('/orderCheckoutNow/').get(bidsController.orderCheckoutNow);

module.exports = bidsRouter;
