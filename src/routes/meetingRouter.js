const express = require('express');

const routes = function (Meeting) {
  const MeetingRouter = express.Router();

  const controller = require('../controllers/meetingController')(Meeting);

  MeetingRouter.route('/meetings/new').post(controller.postMeeting);
  MeetingRouter.route('/meetings').get(controller.getMeetings);
  MeetingRouter.route('/meetings/markRead/:meetingId/:recipient').post(
    controller.markMeetingAsRead,
  );
  MeetingRouter.route('/meetings/upcoming/:organizerId').get(controller.getAllMeetingsByOrganizer);
  MeetingRouter.route('/meeting/:meetingId/calendar').get(controller.getCalendarInvite);
  MeetingRouter.route('/meetings/participant/:participantId').get(controller.getUpcomingMeetingForParticipant);
  return MeetingRouter;
};

module.exports = routes;
