const mongoose = require('mongoose');
const Event = require('../models/event');
const User = require('../models/userProfile');

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

const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

function getMonthRangeAround(inputDate) {
  const [year, month] = inputDate.split('-').map(Number);

  // include two months before and two months after the requested month
  const startDate = new Date(Date.UTC(year, month - 3, 1));
  const endDate = new Date(Date.UTC(year, month + 2, 1));

  return { startDate, endDate };
}

function isValidDateString(value) {
  if (typeof value !== 'string' || !DATE_FORMAT.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);

  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validateQuery({ type, location, sortBy, date }) {
  if (type && !VALID_TYPES.has(type)) {
    throw new Error('Invalid Type of Event.');
  }

  if (location && !VALID_LOCATIONS.has(location)) {
    throw new Error('Invalid Location for the Event.');
  }

  if (sortBy && !VALID_SORT_FIELDS.has(sortBy)) {
    throw new Error('Invalid Sort Field.');
  }

  if (date !== undefined && !isValidDateString(date)) {
    throw new Error('Invalid Date format.');
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

function formatEvent(event, userId) {
  event.status = updateEventStatus(event);

  const eventObj = event.toObject();
  const waitlist = Array.isArray(event.waitlist) ? event.waitlist : [];

  eventObj.waitlistCount = waitlist.length;
  eventObj.waitlistEnabled = event.currentAttendees >= event.maxAttendees;

  if (userId) {
    const index = waitlist.findIndex((entry) => entry.userId?.toString() === userId.toString());

    eventObj.userWaitlistPosition = index !== -1 ? index + 1 : null;
  }

  return eventObj;
}

const getEvents = async function (req, res) {
  try {
    const { page, limit, type, location, sortBy = 'date', date } = req.query;

    validateQuery({ type, location, sortBy, date });

    const safeQuery = buildSafeQuery(location, type);

    if (date !== undefined) {
      const { startDate, endDate } = getMonthRangeAround(date);

      safeQuery.date = {
        $gte: startDate,
        $lt: endDate,
      };
    }

    const totalEvents = await Event.countDocuments(safeQuery);

    const hasLimit = limit !== undefined;
    let pageNumber = 1;
    let limitNumber = totalEvents;
    let skip = 0;

    if (hasLimit) {
      pageNumber = Number(page ?? 1);
      limitNumber = Number(limit);

      if (
        !Number.isSafeInteger(pageNumber) ||
        pageNumber < 1 ||
        !Number.isSafeInteger(limitNumber) ||
        limitNumber < 1
      ) {
        return res.status(400).json({
          error: 'Invalid pagination parameters.',
        });
      }

      skip = (pageNumber - 1) * limitNumber;

      if (!Number.isSafeInteger(skip)) {
        return res.status(400).json({
          error: 'Invalid pagination parameters.',
        });
      }
    } else if (page !== undefined) {
      return res.status(400).json({
        error: 'Invalid pagination parameters.',
      });
    }

    let eventQuery = Event.find(safeQuery)
      .populate('resources.userID', 'firstName lastName profilePic')
      .sort({ [sortBy]: 1, _id: 1 });

    if (hasLimit) {
      eventQuery = eventQuery.skip(skip).limit(limitNumber);
    }

    const events = await eventQuery;

    const formattedEvents = events.map((event) => formatEvent(event, safeQuery.userId));

    let totalPages = 0;

    if (hasLimit) {
      totalPages = Math.ceil(totalEvents / limitNumber);
    } else if (totalEvents > 0) {
      totalPages = 1;
    }

    return res.json({
      events: formattedEvents,
      pagination: {
        total: totalEvents,
        totalPages,
        currentPage: pageNumber,
        limit: limitNumber,
      },
    });
  } catch (error) {
    if (error.message.startsWith('Invalid')) {
      return res.status(400).send(error.message);
    }

    return res.status(500).json({
      error: 'Failed to fetch events',
      details: error.message,
    });
  }
};

const getEventById = async (req, res) => {
  const { id } = req.params;

  try {
    const event = await Event.findById(id).populate(
      'resources.userID',
      'firstName lastName profilePic'
    );
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

const autoPromoteFromWaitlist = (event) => {
  const promotedUsers = [];

  while (event.currentAttendees < event.maxAttendees && event.waitlist.length > 0) {
    const nextEntry = event.waitlist.shift();
    if (nextEntry?.userId) {
      event.currentAttendees += 1;
      promotedUsers.push(nextEntry.userId);
    }
  }

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
    event.currentAttendees -= 1;
    event.status = updateEventStatus(event);

    const updatedEvent = await event.save();
    res.status(200).json(updatedEvent);
  } catch (error) {
    res.status(500).json({ error: 'Failed to unregister from event', details: error.message });
  }
};

const joinWaitlist = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { userId } = req.body;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const event = await Event.findById(eventId);

    if (!event) return res.status(404).json({ error: 'Event not found' });

    const alreadyJoined = event.waitlist.some(
      (entry) => entry.userId?.toString() === userId.toString(),
    );

    if (alreadyJoined) {
      return res.status(400).json({ message: 'Already in waitlist' });
    }

    const position = event.waitlist.length + 1;

    event.waitlist.push({ userId: new mongoose.Types.ObjectId(userId) });

    await event.save({ validateBeforeSave: false });

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

const sendWaitlistNotification = async (user, event) => {
  // TODO: Integrate with real notification service (email/queue)
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

    const promotedUsers = autoPromoteFromWaitlist(event);
    event.markModified('waitlist');
    await event.save({ validateBeforeSave: false });

    for (const userId of promotedUsers) {
      try {
        const user = await User.findById(userId);
        await sendWaitlistNotification(user, event);
      } catch (err) {
        console.error('Notification error:', err);
      }
    }

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

    const event = await Event.findById(eventId);

    if (!event) return res.status(404).json({ error: 'Event not found' });

    const isInWaitlist = event.waitlist.some((entry) => entry.userId.toString() === userId);

    if (!isInWaitlist) {
      return res.status(400).json({ error: 'User not in waitlist' });
    }

    event.waitlist = event.waitlist.filter((entry) => entry.userId.toString() !== userId);

    await event.save({ validateBeforeSave: false });

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
  registerForEvent,
  unregisterFromEvent,
  joinWaitlist,
  leaveEvent,
  leaveWaitlist,
};
