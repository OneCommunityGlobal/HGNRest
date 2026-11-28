const mongoose = require('mongoose');
const moment = require('moment-timezone');
const sanitizeHtml = require('sanitize-html');
const Event = require('../models/event');
const User = require('../models/userProfile');
const emailSender = require('../utilities/emailSender');
const logger = require('../startup/logger');

const updateEventStatus = (event) => {
  if (event.currentAttendees === 0) return 'New';
  if (event.currentAttendees <= event.attendeesThreshold) return 'Need attendees';
  if (event.currentAttendees >= event.maxAttendees) return 'Full';
  if (event.currentAttendees >= event.attendeesThreshold) return 'Filling Fast';
  return event.status;
};

const VALID_TYPES = new Set(['Workshop', 'Meeting', 'Webinar', 'Social Gathering']);
const VALID_LOCATIONS = new Set(['Virtual', 'In person', 'TBD']);
const VALID_SORT_FIELDS = new Set(['date', 'title', 'type', 'location', 'currentAttendees']);
const EVENT_EDITOR_ROLES = new Set(['Owner', 'Administrator']);
const UPDATABLE_FIELDS = [
  'title',
  'type',
  'location',
  'date',
  'startTime',
  'endTime',
  'description',
  'organizer',
  'organizerLogo',
  'coverImage',
  'maxAttendees',
  'isActive',
];

const getRequestorId = (req) => req.body?.requestor?.requestorId || req.user?.requestorId;

const toPlainText = (value) =>
  sanitizeHtml(String(value ?? ''), { allowedTags: [], allowedAttributes: {} });

const formatEventSchedule = (event) => {
  const day = event.date
    ? moment(event.date).tz('America/Los_Angeles').format('dddd, MMM D, YYYY')
    : 'Date TBD';
  const start = event.startTime ? moment(event.startTime).tz('America/Los_Angeles') : null;
  const end = event.endTime ? moment(event.endTime).tz('America/Los_Angeles') : null;
  const time =
    start?.isValid() && end?.isValid()
      ? ` ${start.format('h:mm A')} - ${end.format('h:mm A z')}`
      : '';
  return `${day}${time}`;
};

const emailUsers = async (userIds, subject, buildBody) => {
  try {
    const ids = [...new Set(userIds.filter(Boolean).map((id) => id.toString()))];
    if (ids.length === 0) return;

    const users = await User.find({ _id: { $in: ids } }).select('firstName email');
    await Promise.allSettled(
      users
        .filter((user) => user.email)
        .map((user) => emailSender(user.email, subject, buildBody(user), null, null)),
    );
  } catch (error) {
    logger.logException(error);
  }
};

const sendWaitlistNotification = (users, event) => {
  const title = toPlainText(event.title);
  return emailUsers(
    users.map((user) => user._id),
    `A spot opened up for ${title}`,
    (user) => `
      <p>Hi ${toPlainText(user.firstName)},</p>
      <p>A spot opened up for <strong>${title}</strong> and you have been moved off the waitlist and registered for the event.</p>
      <p>When: ${formatEventSchedule(event)}<br/>Where: ${toPlainText(event.location)}</p>
      <p>If you can no longer attend, please unregister so the next person on the waitlist can take your spot.</p>
    `,
  );
};

const sendEventChangeNotification = (event, change) => {
  const title = toPlainText(event.title);
  const recipients = [
    ...event.resources.map((resource) => resource.userID),
    ...event.waitlist.map((entry) => entry.userId),
  ];
  const subject =
    change === 'cancelled' ? `${title} has been cancelled` : `${title} has been rescheduled`;
  const detail =
    change === 'cancelled'
      ? `<p><strong>${title}</strong> has been cancelled. Your registration or waitlist spot no longer applies.</p>`
      : `<p><strong>${title}</strong> has a new date or time: ${formatEventSchedule(event)}.</p><p>Your registration or waitlist position is unchanged.</p>`;

  return emailUsers(
    recipients,
    subject,
    (user) => `<p>Hi ${toPlainText(user.firstName)},</p>${detail}`,
  );
};

function validateQuery({ type, location, sortBy }) {
  if (type && !VALID_TYPES.has(type)) {
    throw new Error('Invalid Type of Event.');
  }

  if (location && !VALID_LOCATIONS.has(location)) {
    throw new Error('Invalid Location for the Event.');
  }

  if (sortBy && !VALID_SORT_FIELDS.has(sortBy)) {
    throw new Error('Invalid Sort Field.');
  }
}

function buildSafeQuery(location, type) {
  const query = { isActive: true };

  if (location === 'Virtual') {
    query.location = 'Virtual';
  } else if (location === 'In person') {
    query.location = 'In person';
  } else if (location === 'TBD') {
    query.location = 'TBD';
  }

  if (type === 'Workshop') {
    query.type = 'Workshop';
  } else if (type === 'Meeting') {
    query.type = 'Meeting';
  } else if (type === 'Webinar') {
    query.type = 'Webinar';
  } else if (type === 'Social Gathering') {
    query.type = 'Social Gathering';
  }

  return query;
}

function getPagination(page, limit, total) {
  if (!page || !limit) {
    return {
      pageNumber: 1,
      limitNumber: total,
      skip: 0,
    };
  }

  const pageNumber = Math.max(1, Number(page));
  const limitNumber = Math.max(1, Number(limit));

  return {
    pageNumber,
    limitNumber,
    skip: (pageNumber - 1) * limitNumber,
  };
}

function formatEvent(event, userId) {
  event.status = updateEventStatus(event);

  const eventObj = event.toObject();
  const waitlist = Array.isArray(event.waitlist) ? event.waitlist : [];

  eventObj.waitlistCount = waitlist.length;
  eventObj.waitlistEnabled = event.currentAttendees >= event.maxAttendees;
  eventObj.userWaitlistPosition = null;
  eventObj.isUserRegistered = false;

  if (userId) {
    const userKey = userId.toString();
    const index = waitlist.findIndex((entry) => entry.userId?.toString() === userKey);

    eventObj.userWaitlistPosition = index !== -1 ? index + 1 : null;
    eventObj.isUserRegistered = event.resources.some(
      (resource) => (resource.userID?._id ?? resource.userID)?.toString() === userKey,
    );
  }

  // Other users' waitlist entries are not exposed; clients get the count and their own position.
  delete eventObj.waitlist;

  return eventObj;
}

const getEvents = async function (req, res) {
  try {
    const { page, limit, type, location, sortBy, sortOrder = 'asc' } = req.query;

    validateQuery({ type, location, sortBy });

    const safeQuery = buildSafeQuery(location, type);
    const totalEvents = await Event.countDocuments(safeQuery);
    const { pageNumber, limitNumber, skip } = getPagination(page, limit, totalEvents);

    const events = await Event.find(safeQuery)
      .populate('resources.userID')
      .sort(sortBy ? { [sortBy]: sortOrder === 'desc' ? -1 : 1 } : {})
      .skip(skip)
      .limit(limitNumber);

    const requestorId = getRequestorId(req);
    const formattedEvents = events.map((event) => formatEvent(event, requestorId));

    res.json({
      events: formattedEvents,
      pagination: {
        total: totalEvents,
        totalPages: Math.ceil(totalEvents / limitNumber),
        currentPage: pageNumber,
        limit: limitNumber,
      },
    });
  } catch (error) {
    if (error.message.startsWith('Invalid')) {
      return res.status(400).send(error.message);
    }

    res.status(500).json({
      error: 'Failed to fetch events',
      details: error.message,
    });
  }
};

const getEventById = async (req, res) => {
  const { id } = req.params;

  try {
    const event = await Event.findById(id).populate('resources.userID');
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    event.status = updateEventStatus(event);

    res.json(event);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch event',
      details: error.message,
    });
  }
};

const autoPromoteFromWaitlist = async (event) => {
  const openSpots = event.maxAttendees - event.currentAttendees;
  if (openSpots <= 0 || event.waitlist.length === 0) return [];

  const registeredIds = new Set(event.resources.map((resource) => resource.userID?.toString()));
  const waitlistIds = event.waitlist.map((entry) => entry.userId).filter(Boolean);
  const waitlistUsers = await User.find({ _id: { $in: waitlistIds } }).select(
    'firstName lastName email profilePic',
  );
  const usersById = new Map(waitlistUsers.map((user) => [user._id.toString(), user]));
  const promotedUsers = [];

  while (promotedUsers.length < openSpots && event.waitlist.length > 0) {
    const entryId = event.waitlist.shift().userId?.toString();
    const user = usersById.get(entryId);

    if (user && !registeredIds.has(entryId)) {
      event.resources.push({
        name: `${user.firstName} ${user.lastName}`.trim(),
        userID: user._id,
        profilePic: user.profilePic,
      });
      registeredIds.add(entryId);
      promotedUsers.push(user);
    }
  }

  event.currentAttendees += promotedUsers.length;
  event.status = updateEventStatus(event);

  return promotedUsers;
};

const getEventLocations = async (req, res) => {
  try {
    const locations = await Event.distinct('location', { isActive: true });
    res.json({ locations: locations.sort() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch locations', details: error.message });
  }
};

const getEventTypes = async (req, res) => {
  try {
    const types = await Event.distinct('type', { isActive: true });
    res.json({ types: types.sort() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch event types', details: error.message });
  }
};

const createEvent = async (req, res) => {
  try {
    const newEvent = new Event(req.body);
    const savedEvent = await newEvent.save();
    res.status(201).json(savedEvent);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to create event',
      details: error.message,
    });
  }
};

const updateEvent = async (req, res) => {
  const { id } = req.params;

  if (!EVENT_EDITOR_ROLES.has(req.body?.requestor?.role)) {
    return res.status(403).json({ error: 'You are not authorized to update events' });
  }
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid eventId' });
  }

  try {
    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const previous = {
      date: event.date?.getTime(),
      startTime: event.startTime,
      endTime: event.endTime,
      isActive: event.isActive,
    };

    UPDATABLE_FIELDS.forEach((field) => {
      if (req.body[field] !== undefined) event.set(field, req.body[field]);
    });

    if (event.maxAttendees < event.currentAttendees) {
      return res
        .status(400)
        .json({ error: 'maxAttendees cannot be lower than the current number of attendees' });
    }

    const wasCancelled = previous.isActive && !event.isActive;
    const wasRescheduled =
      !wasCancelled &&
      (event.date?.getTime() !== previous.date ||
        event.startTime !== previous.startTime ||
        event.endTime !== previous.endTime);

    const promotedUsers = event.isActive ? await autoPromoteFromWaitlist(event) : [];
    event.status = updateEventStatus(event);

    const savedEvent = await event.save({ validateModifiedOnly: true });

    if (wasCancelled) {
      await sendEventChangeNotification(savedEvent, 'cancelled');
    } else if (wasRescheduled) {
      await sendEventChangeNotification(savedEvent, 'rescheduled');
    }
    await sendWaitlistNotification(promotedUsers, savedEvent);

    res.status(200).json(savedEvent);
  } catch (error) {
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid event data', details: error.message });
    }
    res.status(500).json({ error: 'Failed to update event', details: error.message });
  }
};

const registerForEvent = async (req, res) => {
  const { id } = req.params;
  const { name, userId, profilePic, location } = req.body;

  if (!name || !userId) {
    return res.status(400).json({ error: 'name and userID are required' });
  }

  try {
    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    if (!event.isActive) {
      return res.status(400).json({ error: 'Event is no longer active' });
    }
    if (event.currentAttendees >= event.maxAttendees) {
      return res.status(400).json({ error: 'Event is full' });
    }

    const alreadyRegistered = event.resources.some((r) => r.userID?.toString() === userId);
    if (alreadyRegistered) {
      return res.status(409).json({ error: 'User is already registered for this event' });
    }

    const newAttendees = event.currentAttendees + 1;
    const newStatus = updateEventStatus({ ...event.toObject(), currentAttendees: newAttendees });

    const updatedEvent = await Event.findByIdAndUpdate(
      id,
      {
        $push: { resources: { name, userID: userId, profilePic, location } },
        $pull: { waitlist: { userId } },
        $inc: { currentAttendees: 1 },
        $set: { status: newStatus },
      },
      { new: true },
    );
    res.status(200).json(updatedEvent);
  } catch (error) {
    res.status(500).json({ error: 'Failed to register for event', details: error.message });
  }
};

const unregisterFromEvent = async (req, res) => {
  const { id, userId } = req.params;

  try {
    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const registrantIndex = event.resources.findIndex((r) => r.userID?.toString() === userId);
    if (registrantIndex === -1) {
      return res.status(404).json({ error: 'User is not registered for this event' });
    }

    event.resources.splice(registrantIndex, 1);
    event.currentAttendees = Math.max(0, event.currentAttendees - 1);
    event.status = updateEventStatus(event);

    const promotedUsers = await autoPromoteFromWaitlist(event);
    const updatedEvent = await event.save({ validateModifiedOnly: true });
    await sendWaitlistNotification(promotedUsers, updatedEvent);

    res.status(200).json(updatedEvent);
  } catch (error) {
    res.status(500).json({ error: 'Failed to unregister from event', details: error.message });
  }
};

const joinWaitlist = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { userId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ error: 'Invalid eventId' });
    }
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const event = await Event.findById(eventId);

    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (!event.isActive) return res.status(400).json({ error: 'Event is no longer active' });
    if (event.currentAttendees < event.maxAttendees) {
      return res.status(400).json({ error: 'Event still has open spots' });
    }

    const userKey = String(userId);
    if (event.resources.some((resource) => resource.userID?.toString() === userKey)) {
      return res.status(409).json({ error: 'User is already registered for this event' });
    }

    const userObjectId = new mongoose.Types.ObjectId(userKey);
    const updatedEvent = await Event.findOneAndUpdate(
      { _id: event._id, 'waitlist.userId': { $ne: userObjectId } },
      { $push: { waitlist: { userId: userObjectId, joinedAt: new Date() } } },
      { new: true },
    );

    if (!updatedEvent) {
      return res.status(400).json({ message: 'Already in waitlist' });
    }

    const position =
      updatedEvent.waitlist.findIndex((entry) => entry.userId?.toString() === userKey) + 1;

    res.json({
      message: 'Added to waitlist',
      position,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to join waitlist',
      details: error.message,
    });
  }
};

const leaveEvent = async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId);

    if (!event) return res.status(404).json({ error: 'Event not found' });

    if (event.currentAttendees === 0) {
      return res.status(400).json({ error: 'No attendees to remove' });
    }
    event.currentAttendees -= 1;
    event.status = updateEventStatus(event);

    const promotedUsers = await autoPromoteFromWaitlist(event);
    const updatedEvent = await event.save({ validateModifiedOnly: true });
    await sendWaitlistNotification(promotedUsers, updatedEvent);

    res.json({
      message: 'Left event successfully',
      promotedCount: promotedUsers.length,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to leave event',
      details: error.message,
    });
  }
};

const leaveWaitlist = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { userId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ error: 'Invalid eventId' });
    }
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const userObjectId = new mongoose.Types.ObjectId(String(userId));
    const updatedEvent = await Event.findOneAndUpdate(
      { _id: eventId, 'waitlist.userId': userObjectId },
      { $pull: { waitlist: { userId: userObjectId } } },
      { new: true },
    );

    if (!updatedEvent) {
      const eventExists = await Event.exists({ _id: eventId });
      return eventExists
        ? res.status(400).json({ error: 'User not in waitlist' })
        : res.status(404).json({ error: 'Event not found' });
    }

    res.json({ message: 'Removed from waitlist' });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to leave waitlist',
      details: error.message,
    });
  }
};

module.exports = {
  getEvents,
  getEventById,
  getEventLocations,
  getEventTypes,
  createEvent,
  updateEvent,
  registerForEvent,
  unregisterFromEvent,
  joinWaitlist,
  leaveEvent,
  leaveWaitlist,
};
