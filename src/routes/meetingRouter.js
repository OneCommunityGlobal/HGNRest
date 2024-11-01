const express = require('express');

const routes = function (Meeting) {
  const MeetingRouter = express.Router();

  const controller = require('../controllers/meetingController')(Meeting);

  MeetingRouter.route('/meeting/new').post(controller.postMeeting);


  return MeetingRouter;
}

module.exports = routes;