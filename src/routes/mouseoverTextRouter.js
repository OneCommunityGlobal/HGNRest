const express = require('express');

const routes = function (mouseoverText) {
  const controller = require('../controllers/mouseoverTextController')(mouseoverText);
  const mouseoverTextRouter = express.Router();

  mouseoverTextRouter.route('/mouseoverText')
  .post(controller.createMouseoverText)
  .get(controller.getMouseoverText);

  mouseoverTextRouter.route('/mouseoverText/:id')
  .put(controller.updateMouseoverText);

  return mouseoverTextRouter;
};

module.exports = routes;
