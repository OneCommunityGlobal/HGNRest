const express = require('express');

const routes = function (ownerMessage) {
  const controller = require('../controllers/ownerMessageController')(ownerMessage);
  const OwnerMessageRouter = express.Router();

  OwnerMessageRouter.route('/ownermessage')
  .post(controller.postOwnerMessage);

return OwnerMessageRouter;
};

module.exports = routes;
