const express = require('express');
const eventsController = require('../controllers/eventController');

const eventRouter = express.Router();

eventRouter.get('/events', eventsController.getEvents);
eventRouter.get('/events/types', eventsController.getEventTypes);
eventRouter.get('/events/locations', eventsController.getEventLocations);
eventRouter.post('/events', eventsController.createEvent);

eventRouter.post('/events/:eventId/waitlist', eventsController.joinWaitlist);
eventRouter.delete('/events/:eventId/waitlist', eventsController.leaveWaitlist);
eventRouter.post('/events/:eventId/leave', eventsController.leaveEvent);

module.exports = eventRouter;
