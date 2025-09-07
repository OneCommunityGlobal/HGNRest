const express = require('express');

const route = function (Bid, List, User, Notification) {
  const router = express.Router();
  const controller = require('../../controllers/lbdashboard/biddingOverviewController')(
    Bid,
    List,
    User,
    Notification,
  );

  // Routes
  router.get('/bidOverview/:listingId', controller.getPropertyDetails);
  router.post('/bidOverview/bid/:listingId', controller.placeBid);
  router.get('/bidNotifications/:userId', controller.getNotifications);

  return router;
};

module.exports = route;
