const express = require('express');


const routes = function (task) {
  const controller = require('../controllers/taskController')(task);
  const wbsRouter = express.Router();


  wbsRouter.route('/task/:wbsId')
  .post(controller.postTask)
  
  return wbsRouter;
};

module.exports = routes;
