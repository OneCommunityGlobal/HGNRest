const express = require('express');

const routes = function (ownerStandardMessage) {
  const controller = require('../controllers/ownerStandardMessageController')(ownerStandardMessage);
  const OwnerStandardMessageRouter = express.Router();

  OwnerStandardMessageRouter.route('/ownerStandardMessage')
  .post(controller.postOwnerStandardMessage)
  .get(controller.getOwnerStandardMessage)
  .delete(controller.deleteOwnerStandardMessage);

  OwnerStandardMessageRouter.route('/ownerStandardMessage/:id')
  .put(controller.updateOwnerStandardMessage);

return OwnerStandardMessageRouter;
};

module.exports = routes;
