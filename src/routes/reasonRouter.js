const express = require('express');
const moment = require('moment-timezone');
const reasonController = require('../controllers/reasonSchedulingController');

const route = (ReasonModel, UserModel) => {
  const reasonRouter = express.Router();

  // post a reason to be scheduled
  reasonRouter.post('/reason/', reasonController.postReason);

  // retrieve all user's reasons
  reasonRouter.get('/reason/:userId', reasonController.getAllReasons);

  // get user reason by date
  reasonRouter.get('/reason/single/:userId', reasonController.getSingleReason);

  // update single reason by user's id and date
  reasonRouter.patch('/reason/:userId/', reasonController.patchReason);

  reasonRouter.delete('/reason/:userId', reasonController.deleteReason);

  return reasonRouter;
};

module.exports = route;
