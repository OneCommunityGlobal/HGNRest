const mongoose = require('mongoose');
const GardenCalendar = require('../../models/gardenManagement/gardenCalendar');

const EVENT_TYPES = new Set(['seeding', 'transplanting', 'succession', 'harvesting']);

const EVENT_STATUSES = new Set(['upcoming', 'active', 'growing', 'completed']);

const ALLOWED_UPDATE_FIELDS = [
  'type',
  'name',
  'startDate',
  'endDate',
  'location',
  'date',
  'from',
  'to',
  'lastSow',
  'nextSow',
  'interval',
  'expected',
  'yield',
  'status',
];

const DATE_UPDATE_FIELDS = ['startDate', 'endDate', 'date', 'lastSow', 'nextSow', 'expected'];

const STRING_UPDATE_FIELDS = ['name', 'location', 'from', 'to', 'interval', 'yield'];

const sendServerError = (res, error) => {
  console.error(error);

  return res.status(500).json({
    message: 'Internal server error',
  });
};

const parseDate = (value, fieldName) => {
  if (value === undefined || value === null || value === '') {
    return {
      valid: true,
      value: undefined,
    };
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return {
      valid: false,
      message: `Invalid ${fieldName}`,
    };
  }

  return {
    valid: true,
    value: parsedDate,
  };
};

const validateEventType = (type) => {
  if (typeof type !== 'string' || type === 'All') {
    return null;
  }

  return EVENT_TYPES.has(type) ? null : 'Invalid event type';
};

const validateEventStatus = (status) => {
  if (typeof status !== 'string' || status === 'All') {
    return null;
  }

  return EVENT_STATUSES.has(status) ? null : 'Invalid event status';
};

const parseCreateDates = ({ startDate, endDate, date, lastSow, nextSow, expected }) => {
  const fields = [
    ['startDate', startDate, 'start date'],
    ['endDate', endDate, 'end date'],
    ['date', date, 'date'],
    ['lastSow', lastSow, 'last sow date'],
    ['nextSow', nextSow, 'next sow date'],
    ['expected', expected, 'expected date'],
  ];

  const parsedDates = {};

  for (const [field, value, fieldName] of fields) {
    const parsed = parseDate(value, fieldName);

    if (!parsed.valid) {
      return {
        error: parsed.message,
      };
    }

    parsedDates[field] = parsed.value;
  }

  return {
    value: parsedDates,
  };
};

const validateDateOrder = (startDate, endDate) => {
  if (startDate && endDate && endDate < startDate) {
    return 'End date cannot be before start date';
  }

  return null;
};

const trimIfString = (value) => (typeof value === 'string' ? value.trim() : value);

const getAllowedUpdates = (body) => {
  const updates = {};

  ALLOWED_UPDATE_FIELDS.forEach((field) => {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  });

  return updates;
};

const trimUpdateFields = (updates) => {
  STRING_UPDATE_FIELDS.forEach((field) => {
    if (updates[field] !== undefined) {
      updates[field] = trimIfString(updates[field]);
    }
  });

  return updates;
};

const parseUpdateDates = (updates) => {
  for (const field of DATE_UPDATE_FIELDS) {
    if (updates[field] === undefined) {
      continue;
    }

    const parsedDate = parseDate(updates[field], field);

    if (!parsedDate.valid) {
      return {
        error: parsedDate.message,
      };
    }

    updates[field] = parsedDate.value;
  }

  return {
    value: updates,
  };
};

/**
 * GET all garden calendar events
 *
 * GET /api/kitchenandinventory/gardenmanagement/calendar
 */
const getCalendarEvents = async (req, res) => {
  try {
    const events = await GardenCalendar.find()
      .sort({
        startDate: 1,
        date: 1,
        createdAt: -1,
      })
      .lean();

    return res.status(200).json(events);
  } catch (error) {
    return sendServerError(res, error);
  }
};

/**
 * GET garden calendar event by ID
 *
 * GET /api/kitchenandinventory/gardenmanagement/calendar/:id
 */
const getCalendarEventById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: 'Invalid calendar event ID',
      });
    }

    const event = await GardenCalendar.findById(id).lean();

    if (!event) {
      return res.status(404).json({
        message: 'Calendar event not found',
      });
    }

    return res.status(200).json(event);
  } catch (error) {
    return sendServerError(res, error);
  }
};

/**
 * CREATE garden calendar event
 *
 * POST /api/kitchenandinventory/gardenmanagement/calendar
 */
const createCalendarEvent = async (req, res) => {
  try {
    const {
      type,
      name,
      startDate,
      endDate,
      location,
      date,
      from,
      to,
      lastSow,
      nextSow,
      interval,
      expected,
      yield: expectedYield,
      status,
    } = req.body;

    if (!type || !name) {
      return res.status(400).json({
        message: 'Event type and name are required',
      });
    }

    const typeError = validateEventType(type);

    if (typeError) {
      return res.status(400).json({
        message: typeError,
      });
    }

    const statusError = validateEventStatus(status);

    if (statusError) {
      return res.status(400).json({
        message: statusError,
      });
    }

    const parsedDates = parseCreateDates({
      startDate,
      endDate,
      date,
      lastSow,
      nextSow,
      expected,
    });

    if (parsedDates.error) {
      return res.status(400).json({
        message: parsedDates.error,
      });
    }

    const {
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      date: parsedDate,
      lastSow: parsedLastSow,
      nextSow: parsedNextSow,
      expected: parsedExpected,
    } = parsedDates.value;

    const dateOrderError = validateDateOrder(parsedStartDate, parsedEndDate);

    if (dateOrderError) {
      return res.status(400).json({
        message: dateOrderError,
      });
    }

    const event = await GardenCalendar.create({
      type,
      name: name.trim(),

      startDate: parsedStartDate,

      endDate: parsedEndDate,

      location: trimIfString(location),

      date: parsedDate,

      from: trimIfString(from),

      to: trimIfString(to),

      lastSow: parsedLastSow,

      nextSow: parsedNextSow,

      interval: trimIfString(interval),

      expected: parsedExpected,

      yield: trimIfString(expectedYield),

      status: status || 'upcoming',
    });

    return res.status(201).json(event);
  } catch (error) {
    return sendServerError(res, error);
  }
};

/**
 * UPDATE garden calendar event
 *
 * PUT /api/kitchenandinventory/gardenmanagement/calendar/:id
 */
const updateCalendarEvent = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: 'Invalid calendar event ID',
      });
    }

    const updates = getAllowedUpdates(req.body);

    const typeError = validateEventType(updates.type);

    if (typeError) {
      return res.status(400).json({
        message: typeError,
      });
    }

    const statusError = validateEventStatus(updates.status);

    if (statusError) {
      return res.status(400).json({
        message: statusError,
      });
    }

    trimUpdateFields(updates);

    const parsedDates = parseUpdateDates(updates);

    if (parsedDates.error) {
      return res.status(400).json({
        message: parsedDates.error,
      });
    }

    const existingEvent = await GardenCalendar.findById(id);

    if (!existingEvent) {
      return res.status(404).json({
        message: 'Calendar event not found',
      });
    }

    const finalStartDate =
      updates.startDate !== undefined ? updates.startDate : existingEvent.startDate;

    const finalEndDate = updates.endDate !== undefined ? updates.endDate : existingEvent.endDate;

    const dateOrderError = validateDateOrder(finalStartDate, finalEndDate);

    if (dateOrderError) {
      return res.status(400).json({
        message: dateOrderError,
      });
    }

    const event = await GardenCalendar.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    return res.status(200).json(event);
  } catch (error) {
    return sendServerError(res, error);
  }
};

/**
 * DELETE garden calendar event
 *
 * DELETE /api/kitchenandinventory/gardenmanagement/calendar/:id
 */
const deleteCalendarEvent = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: 'Invalid calendar event ID',
      });
    }

    const event = await GardenCalendar.findByIdAndDelete(id);

    if (!event) {
      return res.status(404).json({
        message: 'Calendar event not found',
      });
    }

    return res.status(200).json({
      message: 'Calendar event deleted successfully',
    });
  } catch (error) {
    return sendServerError(res, error);
  }
};

/**
 * UPDATE garden calendar event status
 *
 * PATCH /api/kitchenandinventory/gardenmanagement/calendar/:id/status
 */
const updateCalendarEventStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: 'Invalid calendar event ID',
      });
    }

    if (!EVENT_STATUSES.has(status)) {
      return res.status(400).json({
        message: 'Invalid event status',
      });
    }

    const event = await GardenCalendar.findByIdAndUpdate(
      id,
      { status },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!event) {
      return res.status(404).json({
        message: 'Calendar event not found',
      });
    }

    return res.status(200).json(event);
  } catch (error) {
    return sendServerError(res, error);
  }
};

module.exports = {
  getCalendarEvents,
  getCalendarEventById,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEventStatus,
};
