const express = require('express');

const routes = function (CalendarEvent, ProcessingProject) {
  const controller = require('../controllers/calendarController')(CalendarEvent, ProcessingProject);
  const calendarRouter = express.Router();

  calendarRouter.route('/').get(controller.getCalendarEvents).post(controller.createEvent);
  calendarRouter.route('/:id').delete(controller.deleteEvent);

  return calendarRouter;
};

module.exports = routes;
