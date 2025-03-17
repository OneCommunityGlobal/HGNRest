const express = require('express');

const routes = (Bid, User) => {
  const userBidRouter = express.Router();
  const controller = require('../../controllers/lbdashboard/userBidController')(Bid, User,);

  userBidRouter.route("/bid").post(controller.placeBid);
}

module.exports = routes;