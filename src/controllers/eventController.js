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

const getEvents = async (req, res) => {
  const { page = 1, limit = 9, type = '', location = '', sortBy = 'date' } = req.query;

  try {
    const validSortFields = ['date', 'title', 'type', 'location', 'currentAttendees'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'date';

    const query = { isActive: true };
    if (type) query.type = type;
    if (location) query.location = location;

    const pageNumber = Math.max(1, Number(page));
    const limitNumber = Math.max(1, Number(limit));

    const totalEvents = await Event.countDocuments(query);
    let events = await Event.find(query)
      .populate('resources.userID')
      .sort({ [sortField]: 1 })
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber);

    events = events.map((event) => {
      event.status = updateEventStatus(event);

      const eventObj = event.toObject();

      eventObj.waitlistCount = event.waitlist?.length || 0;

      eventObj.waitlistEnabled = event.currentAttendees >= event.maxAttendees;

      const { userId } = req.query;

      if (userId && mongoose.Types.ObjectId.isValid(userId)) {
        const index = event.waitlist.findIndex(
          (entry) => entry.userId?.toString() === userId.toString(),
        );

        eventObj.userWaitlistPosition = index !== -1 ? index + 1 : null;
      }

      return eventObj;
    });

    res.json({
      events,
      pagination: {
        total: totalEvents,
        totalPages: Math.ceil(totalEvents / limitNumber),
        currentPage: pageNumber,
        limit: limitNumber,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch events', details: error.message });
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

const autoPromoteFromWaitlist = (event) => {
  const promotedUsers = [];

  while (event.currentAttendees < event.maxAttendees && event.waitlist.length > 0) {
    const nextEntry = event.waitlist.shift();

    if (!nextEntry?.userId) continue;
    console.log(`Auto-promoting user from waitlist for event ${event._id}`);
    event.currentAttendees += 1;
    promotedUsers.push(nextEntry.userId);
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

const joinWaitlist = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { userId } = req.body;
    console.log('Join waitlist request received');

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
    console.error('JOIN WAITLIST ERROR:', error);
    res.status(500).json({
      error: 'Failed to join waitlist',
      details: error.message,
    });
  }
};

const sendWaitlistNotification = async (user, event) => {
  // TODO: Integrate with real notification service (email/queue)
  console.log(`Sending waitlist notification for event ${event._id}`);
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
  joinWaitlist,
  leaveEvent,
  leaveWaitlist,
};
