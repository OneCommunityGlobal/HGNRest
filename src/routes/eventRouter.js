const express = require('express');
const eventsController = require('../controllers/eventController');

const eventRouter = express.Router();

eventRouter.get('/events/types', eventsController.getEventTypes);
eventRouter.get('/events/locations', eventsController.getEventLocations);
eventRouter.get('/events', eventsController.getEvents);
eventRouter.post('/events', eventsController.createEvent);
eventRouter.get('/events/:id', eventsController.getEventById);
eventRouter.post('/events/:id/register', eventsController.registerForEvent);
eventRouter.delete('/events/:id/register/:userId', eventsController.unregisterFromEvent);

eventRouter.post('/events/:eventId/waitlist', eventsController.joinWaitlist);
eventRouter.delete('/events/:eventId/waitlist', eventsController.leaveWaitlist);
eventRouter.post('/events/:eventId/leave', eventsController.leaveEvent);

module.exports = eventRouter;
