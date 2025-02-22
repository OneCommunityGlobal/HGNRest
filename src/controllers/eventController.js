const Event = require('../models/event');

const updateEventStatus = (event) => {
    if(event.currentAttendees === 0) return 'New';
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

        events = events.map(event => {
            event.status = updateEventStatus(event);
            return event;
        });

        res.json({
            events,
            pagination: {
                total: totalEvents,
                totalPages: Math.ceil(totalEvents / limitNumber),
                currentPage: pageNumber,
                limit: limitNumber
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch events', details: error.message });
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
            details: error.message 
        });
    }
};

module.exports = {
    getEvents,
    getEventLocations,
    getEventTypes,
    createEvent,
};