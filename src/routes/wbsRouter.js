const express = require('express');


const routes = function (wbs) {
  const controller = require('../controllers/wbsController')(wbs);
  const wbsRouter = express.Router();

  wbsRouter.route('/wbs/:projectId').get(controller.getAllWBS);

  wbsRouter.route('/wbs/:id')
    .post(controller.postWBS)
    .delete(controller.deleteWBS);

  wbsRouter.route('/wbsId/:id')
    .get(controller.getWBSById);

  wbsRouter.route('/wbs').get(controller.getWBS);

  return wbsRouter;
};

module.exports = routes;
