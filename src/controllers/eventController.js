const Event = require('../models/event');

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
      return event;
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
  const { name, userID, profilePic, location } = req.body;

  if (!name || !userID) {
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

    const alreadyRegistered = event.resources.some((r) => r.userID?.toString() === userID);
    if (alreadyRegistered) {
      return res.status(409).json({ error: 'User is already registered for this event' });
    }

    event.resources.push({ name, userID, profilePic, location });
    event.currentAttendees += 1;
    event.status = updateEventStatus(event);

    const updatedEvent = await event.save();
    res.status(200).json(updatedEvent);
  } catch (error) {
    res.status(500).json({ error: 'Failed to register for event', details: error.message });
  }
};

module.exports = {
  getEvents,
  getEventById,
  getEventLocations,
  getEventTypes,
  createEvent,
  registerForEvent,
};
