const express = require('express');


const routes = function (task) {
  const controller = require('../controllers/taskController')(task);
  const wbsRouter = express.Router();

  wbsRouter.route('/tasks/:wbsId')
    .get(controller.getTasks);

  wbsRouter.route('/task/:wbsId')
    .post(controller.postTask);

  

  return wbsRouter;
};

module.exports = routes;
