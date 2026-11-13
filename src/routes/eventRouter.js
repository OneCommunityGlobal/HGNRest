const express = require('express');
const eventsController = require('../controllers/eventController');
const {
  requireCommunityEventAccess,
  requireOwnEventRegistration,
} = require('../middleware/communityEventAccess');

const eventRouter = express.Router();

// Guard these endpoints individually; the router also shares /api with other modules.
eventRouter.get('/events/types', requireCommunityEventAccess, eventsController.getEventTypes);
eventRouter.get(
  '/events/locations',
  requireCommunityEventAccess,
  eventsController.getEventLocations,
);
eventRouter.get('/events', requireCommunityEventAccess, eventsController.getEvents);
eventRouter.post('/events', requireCommunityEventAccess, eventsController.createEvent);
eventRouter.get('/events/:id', requireCommunityEventAccess, eventsController.getEventById);
eventRouter.post(
  '/events/:id/register',
  requireCommunityEventAccess,
  requireOwnEventRegistration,
  eventsController.registerForEvent,
);
eventRouter.delete(
  '/events/:id/register/:userId',
  requireCommunityEventAccess,
  requireOwnEventRegistration,
  eventsController.unregisterFromEvent,
);

eventRouter.post(
  '/events/:eventId/waitlist',
  requireCommunityEventAccess,
  eventsController.joinWaitlist,
);
eventRouter.delete(
  '/events/:eventId/waitlist',
  requireCommunityEventAccess,
  eventsController.leaveWaitlist,
);
eventRouter.post(
  '/events/:eventId/leave',
  requireCommunityEventAccess,
  eventsController.leaveEvent,
);

module.exports = eventRouter;
