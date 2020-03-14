const express = require('express');


const routes = function (wbs) {
  const controller = require('../controllers/wbsController')(wbs);
  const wbsRouter = express.Router();


  wbsRouter.route('/wbs').get(controller.getAllWBS);

  return wbsRouter;
};

module.exports = routes;
