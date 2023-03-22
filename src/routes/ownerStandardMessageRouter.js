const express = require('express');

const routes = function (ownerStandardMessage) {
  const controller = require('../controllers/ownerStandardMessageController')(ownerStandardMessage);
  const OwnerStandardMessageRouter = express.Router();
  // const imageUploadHelper = require('../helpers/imageUploadHelper');

  OwnerStandardMessageRouter.route('/ownerMessage')
  .post(controller.postOwnerStandardMessage)
  .get(controller.getOwnerStandardMessage)
  .delete(controller.deleteOwnerStandardMessage);

  OwnerStandardMessageRouter.route('/ownerMessage/:id')
  .put(controller.updateOwnerStandardMessage);

return OwnerStandardMessageRouter;
};

module.exports = routes;
