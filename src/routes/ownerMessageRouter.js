const express = require('express');

const routes = function (ownerMessage) {
  const controller = require('../controllers/ownerMessageController')(ownerMessage);
  const OwnerMessageRouter = express.Router();
  // const imageUploadHelper = require('../helpers/imageUploadHelper');

  OwnerMessageRouter.route('/ownerMessage')
  .post(controller.postOwnerMessage)
  .get(controller.getOwnerMessage)
  .delete(controller.deleteOwnerMessage);

  OwnerMessageRouter.route('/ownerMessage/:id')
  .put(controller.updateOwnerMessage);

return OwnerMessageRouter;
};

module.exports = routes;
