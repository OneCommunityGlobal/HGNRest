jest.mock('../../models/event', () => ({
  countDocuments: jest.fn(),
  find: jest.fn(),
  findById: jest.fn(),
}));

const Event = require('../../models/event');
const { getEvents, getEventById } = require('../eventController');

describe('eventController.getEvents', () => {
  let req;
  let res;
  let query;

  const makeEvent = (id, date) => ({
    currentAttendees: 0,
    attendeesThreshold: 5,
    maxAttendees: 10,
    status: 'New',
    waitlist: [],
    toObject: () => ({ _id: id, date }),
  });

  beforeEach(() => {
    jest.clearAllMocks();

    req = { query: {} };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    query = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      then: (resolve, reject) =>
        Promise.resolve([makeEvent('1', '2026-10-15')]).then(resolve, reject),
    };

    Event.countDocuments.mockResolvedValue(1);
    Event.find.mockReturnValue(query);
  });

  it('fetches active events without applying a limit by default', async () => {
    await getEvents(req, res);

    expect(Event.find).toHaveBeenCalledWith({ isActive: true });
    expect(query.sort).toHaveBeenCalledWith({ date: 1, _id: 1 });
    expect(query.limit).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        pagination: expect.objectContaining({
          total: 1,
          totalPages: 1,
        }),
      }),
    );
  });

  it('restricts populated attendee user fields', async () => {
    await getEvents(req, res);

    expect(query.populate).toHaveBeenCalledWith(
      'resources.userID',
      'firstName lastName profilePic',
    );
  });

  it('filters events within two months of the selected month', async () => {
    req.query.date = '2026-10-15';

    await getEvents(req, res);

    expect(Event.find).toHaveBeenCalledWith({
      isActive: true,
      date: {
        $gte: new Date('2026-08-01T00:00:00.000Z'),
        $lt: new Date('2027-01-01T00:00:00.000Z'),
      },
    });
  });

  it('handles date ranges spanning year boundaries', async () => {
    req.query.date = '2026-01-15';

    await getEvents(req, res);

    expect(Event.find).toHaveBeenCalledWith({
      isActive: true,
      date: {
        $gte: new Date('2025-11-01T00:00:00.000Z'),
        $lt: new Date('2026-04-01T00:00:00.000Z'),
      },
    });
  });

  it.each(['2026-02-30', '2026-13-01', 'not-a-date', ''])(
    'rejects invalid date %j',
    async (date) => {
      req.query.date = date;

      await getEvents(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(Event.find).not.toHaveBeenCalled();
    },
  );

  it('applies valid pagination', async () => {
    req.query = { page: '2', limit: '10' };
    Event.countDocuments.mockResolvedValue(25);

    await getEvents(req, res);

    expect(query.skip).toHaveBeenCalledWith(10);
    expect(query.limit).toHaveBeenCalledWith(10);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        pagination: {
          total: 25,
          totalPages: 3,
          currentPage: 2,
          limit: 10,
        },
      }),
    );
  });

  it.each([
    { limit: '0' },
    { limit: '-1' },
    { limit: 'abc' },
    { page: '0', limit: '10' },
    { page: '1.5', limit: '10' },
    { page: '2' },
  ])('rejects invalid pagination parameters %j', async (params) => {
    req.query = params;

    await getEvents(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Event.find).not.toHaveBeenCalled();
  });

  it('handles an empty result set without returning NaN', async () => {
    Event.countDocuments.mockResolvedValue(0);
    query.then = (resolve, reject) => Promise.resolve([]).then(resolve, reject);

    await getEvents(req, res);

    expect(res.json).toHaveBeenCalledWith({
      events: [],
      pagination: {
        total: 0,
        totalPages: 0,
        currentPage: 1,
        limit: 0,
      },
    });
  });
});

describe('eventController.getEventById', () => {
  it('restricts populated attendee user fields', async () => {
    const event = {
      currentAttendees: 0,
      attendeesThreshold: 5,
      maxAttendees: 10,
    };

    const query = {
      populate: jest.fn().mockResolvedValue(event),
    };

    Event.findById.mockReturnValue(query);

    const req = { params: { id: 'event123' } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    await getEventById(req, res);

    expect(Event.findById).toHaveBeenCalledWith('event123');
    expect(query.populate).toHaveBeenCalledWith(
      'resources.userID',
      'firstName lastName profilePic',
    );
    expect(res.json).toHaveBeenCalledWith(event);
  });
});
