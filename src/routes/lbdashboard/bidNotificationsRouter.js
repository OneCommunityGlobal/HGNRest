const express = require('express');
const BidNotifications = require('../../models/lbdashboard/bidnotifications');
const bidNotificationsController =
  require('../../controllers/lbdashboard/bidNotificationsController')(BidNotifications);

const bidNotificationsRouter = express.Router();

bidNotificationsRouter
  .route('/bidNotifications')
  .get(bidNotificationsController.getBidNotifications)
  .post(bidNotificationsController.postBidNotifications);
bidNotificationsRouter
  .route('/bidNotificationsMarkDelivered')
  .post(bidNotificationsController.bidNotificationsMarkDelivered);

module.exports = bidNotificationsRouter;
