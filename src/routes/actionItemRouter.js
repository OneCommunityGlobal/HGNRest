const express = require('express');

const routes = function (actionItem) {
  const controller = require('../controllers/actionItemController')(actionItem);
  const actionItemRouter = express.Router();

  actionItemRouter.route('/actionItem')
    .post(controller.postactionItem);

  actionItemRouter.route('/actionItem/user/:userId')
    .get(controller.getactionItem);

  actionItemRouter.route('/actionItem/:actionItemId')
    .delete(controller.deleteactionItem)
    .put(controller.editactionItem);

  return actionItemRouter;
};

module.exports = routes;
