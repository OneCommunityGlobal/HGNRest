const mockSave = jest.fn();

jest.mock('../../models/event', () => {
  const MockEvent = jest.fn().mockImplementation(function EventCtor(data) {
    Object.assign(this, data);
    this.save = mockSave;
  });
  MockEvent.countDocuments = jest.fn();
  MockEvent.find = jest.fn();
  MockEvent.findById = jest.fn();
  MockEvent.distinct = jest.fn();
  return MockEvent;
});

jest.mock('../../models/userProfile', () => ({
  findById: jest.fn(),
}));

const Event = require('../../models/event');
const { getEvents, createEvent } = require('../eventController');

describe('eventController.getEvents', () => {
  const buildRes = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  });

  const buildQueryChain = (events) => ({
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue(events),
  });

  const makeMockEvent = (overrides = {}) => {
    const base = {
      currentAttendees: 1,
      attendeesThreshold: 5,
      maxAttendees: 10,
      status: 'New',
      waitlist: [],
      ...overrides,
    };
    base.toObject = jest.fn(() => ({ ...base }));
    return base;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Event.countDocuments.mockResolvedValue(0);
  });

  test('returns 400 for an invalid type', async () => {
    const req = { query: { type: 'Not A Real Type' } };
    const res = buildRes();

    await getEvents(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith('Invalid Type of Event.');
    expect(Event.find).not.toHaveBeenCalled();
  });

  test('returns 400 for an invalid location', async () => {
    const req = { query: { location: 'Outer Space' } };
    const res = buildRes();

    await getEvents(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith('Invalid Location for the Event.');
  });

  test('returns 400 for an invalid sortBy field', async () => {
    const req = { query: { sortBy: 'notARealField' } };
    const res = buildRes();

    await getEvents(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith('Invalid Sort Field.');
  });

  test('returns 400 for a malformed date (wrong shape)', async () => {
    const req = { query: { date: '03-15-2026' } };
    const res = buildRes();

    await getEvents(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith('Invalid Date format.');
    expect(Event.find).not.toHaveBeenCalled();
  });

  test('returns 400 for a calendar-invalid date (e.g. month 13)', async () => {
    const req = { query: { date: '2026-13-99' } };
    const res = buildRes();

    await getEvents(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith('Invalid Date format.');
  });

  test('rejects an object-injection attempt on the date param', async () => {
    // Simulates ?date[$gt]= style query-string pollution; Express/qs would
    // hand this to the controller as an object rather than a string.
    const req = { query: { date: { $gt: '' } } };
    const res = buildRes();

    await getEvents(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith('Invalid Date format.');
  });

  test('applies a date range filter for a valid date', async () => {
    const chain = buildQueryChain([]);
    Event.find.mockReturnValue(chain);
    Event.countDocuments.mockResolvedValue(0);

    const req = { query: { date: '2026-03-15' } };
    const res = buildRes();

    await getEvents(req, res);

    expect(Event.countDocuments).toHaveBeenCalledWith(
      expect.objectContaining({
        isActive: true,
        date: { $gte: '2026-01-01', $lte: '2026-05-31' },
      }),
    );
    expect(res.status).not.toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalled();
  });

  test('builds the query from whitelisted type and location instead of raw input', async () => {
    const chain = buildQueryChain([]);
    Event.find.mockReturnValue(chain);
    Event.countDocuments.mockResolvedValue(0);

    const req = { query: { type: 'Workshop', location: 'Virtual' } };
    const res = buildRes();

    await getEvents(req, res);

    expect(Event.countDocuments).toHaveBeenCalledWith({
      isActive: true,
      type: 'Workshop',
      location: 'Virtual',
    });
  });

  test('paginates when limit is provided', async () => {
    const events = [makeMockEvent({ id: 1 }), makeMockEvent({ id: 2 })];
    const chain = buildQueryChain(events);
    Event.find.mockReturnValue(chain);
    Event.countDocuments.mockResolvedValue(20);

    const req = { query: { page: '2', limit: '2' } };
    const res = buildRes();

    await getEvents(req, res);

    expect(chain.skip).toHaveBeenCalledWith(2);
    expect(chain.limit).toHaveBeenCalledWith(2);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        pagination: expect.objectContaining({
          total: 20,
          totalPages: 10,
          currentPage: 2,
          limit: 2,
        }),
      }),
    );
  });

  test('returns all matching events when no limit is provided', async () => {
    const events = [makeMockEvent({ id: 1 }), makeMockEvent({ id: 2 }), makeMockEvent({ id: 3 })];
    const chain = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockResolvedValue(events),
    };
    Event.find.mockReturnValue(chain);
    Event.countDocuments.mockResolvedValue(3);

    const req = { query: {} };
    const res = buildRes();

    await getEvents(req, res);

    expect(chain.sort).toHaveBeenCalledWith({ date: 1 });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        pagination: expect.objectContaining({ total: 3, currentPage: 1 }),
      }),
    );
  });

  test('returns 500 when the database call fails', async () => {
    Event.find.mockImplementation(() => {
      throw new Error('connection lost');
    });
    Event.countDocuments.mockResolvedValue(1);

    const req = { query: {} };
    const res = buildRes();

    await getEvents(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Failed to fetch events' }),
    );
  });
});

describe('eventController.createEvent', () => {
  const buildRes = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns a generic success message without echoing the saved document', async () => {
    mockSave.mockResolvedValue({ _id: 'abc123', title: 'Team Sync' });

    const req = { body: { title: 'Team Sync' } };
    const res = buildRes();

    await createEvent(req, res);

    expect(mockSave).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      status: 'success',
      message: 'Event details saved successfully',
    });
  });

  test('returns 500 when saving fails', async () => {
    mockSave.mockRejectedValue(new Error('validation failed'));

    const req = { body: {} };
    const res = buildRes();

    await createEvent(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Failed to create event' }),
    );
  });
});
