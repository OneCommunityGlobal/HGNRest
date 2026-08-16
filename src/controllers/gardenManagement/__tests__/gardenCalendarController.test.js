const mongoose = require('mongoose');

jest.mock('../../../models/gardenManagement/gardenCalendar', () => ({
  find: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn(),
  create: jest.fn(),
}));

const GardenCalendar = require('../../../models/gardenManagement/gardenCalendar');
const {
  getCalendarEvents,
  getCalendarEventById,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEventStatus,
} = require('../gardenCalendarController');

describe('Garden Calendar Controller', () => {
  let req;
  let res;

  const validId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      query: {},
      params: {},
      body: {},
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  // ==================================================
  // GET ALL CALENDAR EVENTS
  // ==================================================

  describe('getCalendarEvents', () => {
    const mockEvents = [
      {
        _id: validId,
        type: 'seeding',
        name: 'Tomato Seeds',
      },
    ];

    const setupFindMock = (events) => {
      const leanMock = jest.fn().mockResolvedValue(events);

      const sortMock = jest.fn().mockReturnValue({
        lean: leanMock,
      });

      GardenCalendar.find.mockReturnValue({
        sort: sortMock,
      });

      return {
        sortMock,
        leanMock,
      };
    };

    it('should return all calendar events successfully', async () => {
      const { sortMock, leanMock } = setupFindMock(mockEvents);

      await getCalendarEvents(req, res);

      expect(GardenCalendar.find).toHaveBeenCalledWith();

      expect(sortMock).toHaveBeenCalledWith({
        startDate: 1,
        date: 1,
        createdAt: -1,
      });

      expect(leanMock).toHaveBeenCalled();

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockEvents);
    });

    it('should ignore query parameters and return all events', async () => {
      setupFindMock(mockEvents);

      req.query = {
        search: 'tomato',
        type: 'seeding',
        status: 'upcoming',
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      };

      await getCalendarEvents(req, res);

      expect(GardenCalendar.find).toHaveBeenCalledWith();
      expect(GardenCalendar.find).toHaveBeenCalledTimes(1);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockEvents);
    });

    it('should return all events when no query parameters are provided', async () => {
      setupFindMock(mockEvents);

      req.query = {};

      await getCalendarEvents(req, res);

      expect(GardenCalendar.find).toHaveBeenCalledWith();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockEvents);
    });

    it('should return 500 when database query fails', async () => {
      const error = new Error('Database error');

      const leanMock = jest.fn().mockRejectedValue(error);

      GardenCalendar.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: leanMock,
        }),
      });

      await getCalendarEvents(req, res);

      expect(res.status).toHaveBeenCalledWith(500);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Internal server error',
      });
    });
  });

  // ==================================================
  // GET EVENT BY ID
  // ==================================================

  describe('getCalendarEventById', () => {
    it('should return an event by valid ID', async () => {
      const event = {
        _id: validId,
        name: 'Tomato',
        type: 'seeding',
      };

      const leanMock = jest.fn().mockResolvedValue(event);

      GardenCalendar.findById.mockReturnValue({
        lean: leanMock,
      });

      req.params.id = validId;

      await getCalendarEventById(req, res);

      expect(GardenCalendar.findById).toHaveBeenCalledWith(validId);

      expect(res.status).toHaveBeenCalledWith(200);

      expect(res.json).toHaveBeenCalledWith(event);
    });

    it('should reject invalid ID', async () => {
      req.params.id = 'invalid-id';

      await getCalendarEventById(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid calendar event ID',
      });

      expect(GardenCalendar.findById).not.toHaveBeenCalled();
    });

    it('should return 404 when event does not exist', async () => {
      const leanMock = jest.fn().mockResolvedValue(null);

      GardenCalendar.findById.mockReturnValue({
        lean: leanMock,
      });

      req.params.id = validId;

      await getCalendarEventById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Calendar event not found',
      });
    });

    it('should return 500 when database query fails', async () => {
      const error = new Error('Database error');

      const leanMock = jest.fn().mockRejectedValue(error);

      GardenCalendar.findById.mockReturnValue({
        lean: leanMock,
      });

      req.params.id = validId;

      await getCalendarEventById(req, res);

      expect(res.status).toHaveBeenCalledWith(500);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Internal server error',
      });
    });
  });

  // ==================================================
  // CREATE EVENT
  // ==================================================

  describe('createCalendarEvent', () => {
    const validBody = {
      type: 'seeding',
      name: '  Tomato Seeds  ',
      startDate: '2026-08-15',
      endDate: '2026-08-20',
      location: '  Garden A  ',
      date: '2026-08-15',
      from: ' 08:00 ',
      to: ' 10:00 ',
      lastSow: '2026-07-01',
      nextSow: '2026-09-01',
      interval: ' 2 weeks ',
      expected: '2026-09-15',
      yield: ' 50 lbs ',
      status: 'upcoming',
    };

    it('should create a calendar event successfully', async () => {
      const createdEvent = {
        _id: validId,
        ...validBody,
      };

      GardenCalendar.create.mockResolvedValue(createdEvent);

      req.body = validBody;

      await createCalendarEvent(req, res);

      expect(GardenCalendar.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'seeding',
          name: 'Tomato Seeds',
          location: 'Garden A',
          from: '08:00',
          to: '10:00',
          interval: '2 weeks',
          yield: '50 lbs',
          status: 'upcoming',
        }),
      );

      expect(res.status).toHaveBeenCalledWith(201);

      expect(res.json).toHaveBeenCalledWith(createdEvent);
    });

    it('should use upcoming as the default status', async () => {
      GardenCalendar.create.mockResolvedValue({
        _id: validId,
      });

      req.body = {
        type: 'seeding',
        name: 'Tomato',
      };

      await createCalendarEvent(req, res);

      expect(GardenCalendar.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'upcoming',
        }),
      );

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should reject missing type', async () => {
      req.body = {
        name: 'Tomato',
      };

      await createCalendarEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Event type and name are required',
      });

      expect(GardenCalendar.create).not.toHaveBeenCalled();
    });

    it('should reject missing name', async () => {
      req.body = {
        type: 'seeding',
      };

      await createCalendarEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Event type and name are required',
      });

      expect(GardenCalendar.create).not.toHaveBeenCalled();
    });

    it('should reject invalid event type', async () => {
      req.body = {
        type: 'invalid',
        name: 'Tomato',
      };

      await createCalendarEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid event type',
      });

      expect(GardenCalendar.create).not.toHaveBeenCalled();
    });

    it('should reject invalid event status', async () => {
      req.body = {
        type: 'seeding',
        name: 'Tomato',
        status: 'invalid',
      };

      await createCalendarEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid event status',
      });

      expect(GardenCalendar.create).not.toHaveBeenCalled();
    });

    it('should reject invalid start date', async () => {
      req.body = {
        type: 'seeding',
        name: 'Tomato',
        startDate: 'invalid-date',
      };

      await createCalendarEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid start date',
      });
    });

    it('should reject invalid end date', async () => {
      req.body = {
        type: 'seeding',
        name: 'Tomato',
        endDate: 'invalid-date',
      };

      await createCalendarEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid end date',
      });
    });

    it('should reject invalid date', async () => {
      req.body = {
        type: 'seeding',
        name: 'Tomato',
        date: 'invalid-date',
      };

      await createCalendarEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid date',
      });
    });

    it('should reject invalid last sow date', async () => {
      req.body = {
        type: 'seeding',
        name: 'Tomato',
        lastSow: 'invalid-date',
      };

      await createCalendarEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid last sow date',
      });
    });

    it('should reject invalid next sow date', async () => {
      req.body = {
        type: 'seeding',
        name: 'Tomato',
        nextSow: 'invalid-date',
      };

      await createCalendarEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid next sow date',
      });
    });

    it('should reject invalid expected date', async () => {
      req.body = {
        type: 'seeding',
        name: 'Tomato',
        expected: 'invalid-date',
      };

      await createCalendarEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid expected date',
      });
    });

    it('should reject end date before start date', async () => {
      req.body = {
        type: 'seeding',
        name: 'Tomato',
        startDate: '2026-08-20',
        endDate: '2026-08-10',
      };

      await createCalendarEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        message: 'End date cannot be before start date',
      });

      expect(GardenCalendar.create).not.toHaveBeenCalled();
    });

    it('should return 500 when creation fails', async () => {
      GardenCalendar.create.mockRejectedValue(new Error('Database error'));

      req.body = {
        type: 'seeding',
        name: 'Tomato',
      };

      await createCalendarEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(500);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Internal server error',
      });
    });
  });

  // ==================================================
  // UPDATE EVENT
  // ==================================================

  describe('updateCalendarEvent', () => {
    const existingEvent = {
      _id: validId,
      type: 'seeding',
      name: 'Old Name',
      startDate: new Date('2026-08-10'),
      endDate: new Date('2026-08-20'),
      status: 'upcoming',
    };

    const updatedEvent = {
      ...existingEvent,
      name: 'Updated Name',
    };

    const setupUpdateMocks = (existing = existingEvent, updated = updatedEvent) => {
      GardenCalendar.findById.mockResolvedValue(existing);
      GardenCalendar.findByIdAndUpdate.mockResolvedValue(updated);
    };

    it('should update an event successfully', async () => {
      setupUpdateMocks();

      req.params.id = validId;

      req.body = {
        name: '  Updated Name  ',
        location: '  Garden B  ',
        type: 'transplanting',
        status: 'active',
      };

      await updateCalendarEvent(req, res);

      expect(GardenCalendar.findByIdAndUpdate).toHaveBeenCalledWith(
        validId,
        {
          name: 'Updated Name',
          location: 'Garden B',
          type: 'transplanting',
          status: 'active',
        },
        {
          new: true,
          runValidators: true,
        },
      );

      expect(res.status).toHaveBeenCalledWith(200);

      expect(res.json).toHaveBeenCalledWith(updatedEvent);
    });

    it('should reject invalid ID', async () => {
      req.params.id = 'invalid-id';

      await updateCalendarEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid calendar event ID',
      });

      expect(GardenCalendar.findById).not.toHaveBeenCalled();
    });

    it('should reject invalid event type', async () => {
      req.params.id = validId;

      req.body = {
        type: 'invalid',
      };

      await updateCalendarEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid event type',
      });

      expect(GardenCalendar.findById).not.toHaveBeenCalled();
    });

    it('should reject invalid event status', async () => {
      req.params.id = validId;

      req.body = {
        status: 'invalid',
      };

      await updateCalendarEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid event status',
      });

      expect(GardenCalendar.findById).not.toHaveBeenCalled();
    });

    it('should trim string fields', async () => {
      setupUpdateMocks();

      req.params.id = validId;

      req.body = {
        name: ' Name ',
        location: ' Location ',
        from: ' From ',
        to: ' To ',
        interval: ' Interval ',
        yield: ' Yield ',
      };

      await updateCalendarEvent(req, res);

      expect(GardenCalendar.findByIdAndUpdate).toHaveBeenCalledWith(
        validId,
        {
          name: 'Name',
          location: 'Location',
          from: 'From',
          to: 'To',
          interval: 'Interval',
          yield: 'Yield',
        },
        {
          new: true,
          runValidators: true,
        },
      );
    });

    it('should parse date fields', async () => {
      setupUpdateMocks();

      req.params.id = validId;

      req.body = {
        startDate: '2026-09-01',
        endDate: '2026-09-10',
        date: '2026-09-02',
        lastSow: '2026-08-01',
        nextSow: '2026-09-20',
        expected: '2026-10-01',
      };

      await updateCalendarEvent(req, res);

      const updates = GardenCalendar.findByIdAndUpdate.mock.calls[0][1];

      expect(updates.startDate).toEqual(new Date('2026-09-01'));
      expect(updates.endDate).toEqual(new Date('2026-09-10'));
      expect(updates.date).toEqual(new Date('2026-09-02'));
      expect(updates.lastSow).toEqual(new Date('2026-08-01'));
      expect(updates.nextSow).toEqual(new Date('2026-09-20'));
      expect(updates.expected).toEqual(new Date('2026-10-01'));
    });

    it('should reject invalid startDate', async () => {
      req.params.id = validId;

      req.body = {
        startDate: 'invalid-date',
      };

      await updateCalendarEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid startDate',
      });

      expect(GardenCalendar.findById).not.toHaveBeenCalled();
    });

    it('should reject invalid endDate', async () => {
      req.params.id = validId;

      req.body = {
        endDate: 'invalid-date',
      };

      await updateCalendarEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid endDate',
      });

      expect(GardenCalendar.findById).not.toHaveBeenCalled();
    });

    it('should reject invalid date', async () => {
      req.params.id = validId;

      req.body = {
        date: 'invalid-date',
      };

      await updateCalendarEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid date',
      });

      expect(GardenCalendar.findById).not.toHaveBeenCalled();
    });

    it('should reject invalid lastSow date', async () => {
      req.params.id = validId;

      req.body = {
        lastSow: 'invalid-date',
      };

      await updateCalendarEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid lastSow',
      });

      expect(GardenCalendar.findById).not.toHaveBeenCalled();
    });

    it('should reject invalid nextSow date', async () => {
      req.params.id = validId;

      req.body = {
        nextSow: 'invalid-date',
      };

      await updateCalendarEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid nextSow',
      });

      expect(GardenCalendar.findById).not.toHaveBeenCalled();
    });

    it('should reject invalid expected date', async () => {
      req.params.id = validId;

      req.body = {
        expected: 'invalid-date',
      };

      await updateCalendarEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid expected',
      });

      expect(GardenCalendar.findById).not.toHaveBeenCalled();
    });

    it('should return 404 when event does not exist', async () => {
      GardenCalendar.findById.mockResolvedValue(null);

      req.params.id = validId;

      req.body = {
        name: 'Updated Name',
      };

      await updateCalendarEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(404);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Calendar event not found',
      });

      expect(GardenCalendar.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should reject end date before existing start date', async () => {
      setupUpdateMocks();

      req.params.id = validId;

      req.body = {
        endDate: '2026-08-01',
      };

      await updateCalendarEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        message: 'End date cannot be before start date',
      });

      expect(GardenCalendar.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should reject end date before updated start date', async () => {
      setupUpdateMocks();

      req.params.id = validId;

      req.body = {
        startDate: '2026-09-20',
        endDate: '2026-09-10',
      };

      await updateCalendarEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        message: 'End date cannot be before start date',
      });

      expect(GardenCalendar.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should update only allowed fields', async () => {
      setupUpdateMocks();

      req.params.id = validId;

      req.body = {
        name: 'Updated',
        unauthorizedField: 'should not update',
      };

      await updateCalendarEvent(req, res);

      const updates = GardenCalendar.findByIdAndUpdate.mock.calls[0][1];

      expect(updates).toEqual({
        name: 'Updated',
      });

      expect(updates.unauthorizedField).toBeUndefined();
    });

    it('should return 500 when findById fails', async () => {
      GardenCalendar.findById.mockRejectedValue(new Error('Database error'));

      req.params.id = validId;

      req.body = {
        name: 'Updated',
      };

      await updateCalendarEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(500);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Internal server error',
      });

      expect(GardenCalendar.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should return 500 when findByIdAndUpdate fails', async () => {
      GardenCalendar.findById.mockResolvedValue(existingEvent);

      GardenCalendar.findByIdAndUpdate.mockRejectedValue(new Error('Database error'));

      req.params.id = validId;

      req.body = {
        name: 'Updated',
      };

      await updateCalendarEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(500);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Internal server error',
      });
    });
  });

  // ==================================================
  // DELETE EVENT
  // ==================================================

  describe('deleteCalendarEvent', () => {
    it('should delete an event successfully', async () => {
      const event = {
        _id: validId,
        name: 'Tomato',
      };

      GardenCalendar.findByIdAndDelete.mockResolvedValue(event);

      req.params.id = validId;

      await deleteCalendarEvent(req, res);

      expect(GardenCalendar.findByIdAndDelete).toHaveBeenCalledWith(validId);

      expect(res.status).toHaveBeenCalledWith(200);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Calendar event deleted successfully',
      });
    });

    it('should reject invalid ID', async () => {
      req.params.id = 'invalid-id';

      await deleteCalendarEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid calendar event ID',
      });

      expect(GardenCalendar.findByIdAndDelete).not.toHaveBeenCalled();
    });

    it('should return 404 when event does not exist', async () => {
      GardenCalendar.findByIdAndDelete.mockResolvedValue(null);

      req.params.id = validId;

      await deleteCalendarEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(404);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Calendar event not found',
      });
    });

    it('should return 500 when delete fails', async () => {
      GardenCalendar.findByIdAndDelete.mockRejectedValue(new Error('Database error'));

      req.params.id = validId;

      await deleteCalendarEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(500);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Internal server error',
      });
    });
  });

  // ==================================================
  // UPDATE EVENT STATUS
  // ==================================================

  describe('updateCalendarEventStatus', () => {
    const updatedEvent = {
      _id: validId,
      status: 'completed',
    };

    it('should update event status successfully', async () => {
      GardenCalendar.findByIdAndUpdate.mockResolvedValue(updatedEvent);

      req.params.id = validId;

      req.body = {
        status: 'completed',
      };

      await updateCalendarEventStatus(req, res);

      expect(GardenCalendar.findByIdAndUpdate).toHaveBeenCalledWith(
        validId,
        {
          status: 'completed',
        },
        {
          new: true,
          runValidators: true,
        },
      );

      expect(res.status).toHaveBeenCalledWith(200);

      expect(res.json).toHaveBeenCalledWith(updatedEvent);
    });

    it('should reject invalid ID', async () => {
      req.params.id = 'invalid-id';

      req.body = {
        status: 'completed',
      };

      await updateCalendarEventStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid calendar event ID',
      });

      expect(GardenCalendar.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should reject invalid status', async () => {
      req.params.id = validId;

      req.body = {
        status: 'invalid',
      };

      await updateCalendarEventStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid event status',
      });

      expect(GardenCalendar.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('should return 404 when event does not exist', async () => {
      GardenCalendar.findByIdAndUpdate.mockResolvedValue(null);

      req.params.id = validId;

      req.body = {
        status: 'completed',
      };

      await updateCalendarEventStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(404);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Calendar event not found',
      });
    });

    it('should return 500 when status update fails', async () => {
      GardenCalendar.findByIdAndUpdate.mockRejectedValue(new Error('Database error'));

      req.params.id = validId;

      req.body = {
        status: 'completed',
      };

      await updateCalendarEventStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(500);

      expect(res.json).toHaveBeenCalledWith({
        message: 'Internal server error',
      });
    });
  });
});
