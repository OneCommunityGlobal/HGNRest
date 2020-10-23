const express = require('express');


const routes = function (wbs) {
  const controller = require('../controllers/wbsController')(wbs);
  const wbsRouter = express.Router();

  wbsRouter.route('/wbs/:projectId').get(controller.getAllWBS);

  wbsRouter.route('/wbs/:id')
    .post(controller.postWBS)
    .delete(controller.deleteWBS);

  return wbsRouter;
};

module.exports = routes;
