const express = require('express');

const routes = (Bid, List, User, Notification) => {
  const userBidRouter = express.Router();
  const controller = require('../../controllers/lbdashboard/userBidNotificationController')(Bid, List, User, Notification);

  userBidRouter.route("/bid/:id").post(controller.placeBid);

  return userBidRouter
}

module.exports = routes;