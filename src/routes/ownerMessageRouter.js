const express = require('express');

const routes = function (ownerMessage) {
  const controller = require('../controllers/ownerMessageController')(ownerMessage);
  const OwnerMessageRouter = express.Router();

  OwnerMessageRouter.route('/ownerMessage')
  .post(controller.postOwnerMessage)
  .get(controller.getOwnerMessage)
  .delete(controller.deleteOwnerMessage);

return OwnerMessageRouter;
};

module.exports = routes;
