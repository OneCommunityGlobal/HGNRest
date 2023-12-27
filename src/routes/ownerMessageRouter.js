const express = require('express');

const routes = function (ownerMessage) {
  const controller = require('../controllers/ownerMessageController')(ownerMessage);
  const OwnerMessageRouter = express.Router();

  OwnerMessageRouter.route('/ownerMessage')
    .get(controller.getOwnerMessage)
    .put(controller.updateOwnerMessage)
    .delete(controller.deleteOwnerMessage);

  return OwnerMessageRouter;
};

module.exports = routes;
