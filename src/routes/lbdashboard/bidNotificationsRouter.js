const express = require('express');
const BidNotifications = require('../../models/lbdashboard/bidnotifications');
const bidNotificationsController =
  require('../../controllers/lbdashboard/bidNotificationsController')(BidNotifications);

const bidNotificationsRouter = express.Router();
console.log('BidNotificationsRouter');

bidNotificationsRouter
  .route('/bidNotifications')
  .get(bidNotificationsController.getBidNotifications)
  .post(bidNotificationsController.postBidNotifications);

/*
bidTermsRouter
  .route('/bidTerms')
  .get(bidTermsController.getBidTerms)
  .post(bidTermsController.postBidTerms);


bidNotificationsRouter
  .route('/bidNotifications')
  .get(bidNotificationsController.getNotifications)
  .post(bidNotificationsController.postNotifications);
*/
module.exports = bidNotificationsRouter;
