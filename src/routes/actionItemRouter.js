const express = require('express');


const routes = function (actionItem) {
  const controller = require('../controllers/actionItemController')(actionItem);
  const actionItemRouter = express.Router();

  actionItemRouter.route('/actionItem')
    .post(controller.postActionItem);


  actionItemRouter.route('/actionItem/user/:userId')
    .get(controller.getActionItem);


  actionItemRouter.route('/actionItem/:actionItemId')
    .delete(controller.deleteActionItem)
    .put(controller.editActionItem);

  return actionItemRouter;
};

module.exports = routes;
