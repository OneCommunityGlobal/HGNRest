const express = require('express');

const routes = function (Timer) {
  const TimerRouter = express.Router();

  const controller = require('../controllers/timerController')(Timer);
  
  TimerRouter.route('/timer/:userId')
    .put(controller.putTimer)
    .get(controller.getTimer);

  return TimerRouter;
};
  
module.exports = routes;
