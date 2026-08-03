jest.mock('../../models/event', () => ({
  find: jest.fn(),
}));

const Event = require('../../models/event');
const eventPopularityController = require('../eventPopularityController');

const getController = () => eventPopularityController();

const makeReq = (query = {}) => ({ query });

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnThis();
  res.json = jest.fn().mockReturnThis();
  return res;
};

const mockEventFind = (events) => {
  Event.find.mockReturnValue({ lean: jest.fn().mockResolvedValue(events) });
};

describe('eventPopularityController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPopularityMetrics', () => {
    it('returns empty metrics when there are no events', async () => {
      mockEventFind([]);
      const controller = getController();
      const req = makeReq();
      const res = makeRes();

      await controller.getPopularityMetrics(req, res);

      expect(res.json).toHaveBeenCalledWith({ metrics: [] });
    });

    it('groups events by type and calculates averages', async () => {
      mockEventFind([
        {
          _id: '1',
          type: 'Workshop',
          title: 'A',
          currentAttendees: 10,
          maxAttendees: 20,
          location: 'Virtual',
        },
        {
          _id: '2',
          type: 'Workshop',
          title: 'B',
          currentAttendees: 20,
          maxAttendees: 20,
          location: 'Virtual',
        },
        {
          _id: '3',
          type: 'Meeting',
          title: 'C',
          currentAttendees: 5,
          maxAttendees: 10,
          location: 'In person',
        },
      ]);
      const controller = getController();
      const req = makeReq();
      const res = makeRes();

      await controller.getPopularityMetrics(req, res);

      const { metrics } = res.json.mock.calls[0][0];
      const workshop = metrics.find((m) => m.eventType === 'Workshop');
      const meeting = metrics.find((m) => m.eventType === 'Meeting');

      expect(workshop.totalEvents).toBe(2);
      expect(workshop.totalAttendees).toBe(30);
      expect(workshop.averageAttendeesPerEvent).toBe(15);
      expect(meeting.totalEvents).toBe(1);
      expect(meeting.averageAttendeesPerEvent).toBe(5);
    });

    it('defaults missing type to Unknown', async () => {
      mockEventFind([{ _id: '1', title: 'A', currentAttendees: 1, maxAttendees: 5 }]);
      const controller = getController();
      const req = makeReq();
      const res = makeRes();

      await controller.getPopularityMetrics(req, res);

      const { metrics } = res.json.mock.calls[0][0];
      expect(metrics[0].eventType).toBe('Unknown');
    });

    it('applies startDate and endDate filters to the query', async () => {
      mockEventFind([]);
      const controller = getController();
      const req = makeReq({ startDate: '2024-01-01', endDate: '2024-01-31' });
      const res = makeRes();

      await controller.getPopularityMetrics(req, res);

      const calledQuery = Event.find.mock.calls[0][0];
      expect(calledQuery.date.$gte).toEqual(new Date('2024-01-01'));
      expect(calledQuery.date.$lte).toEqual(new Date('2024-01-31'));
    });

    it('returns 500 on database error', async () => {
      Event.find.mockImplementation(() => {
        throw new Error('DB failure');
      });
      const controller = getController();
      const req = makeReq();
      const res = makeRes();

      await controller.getPopularityMetrics(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Failed to fetch popularity metrics' }),
      );
    });
  });

  describe('getEngagementMetrics', () => {
    it('returns zeroed engagement when there are no events', async () => {
      mockEventFind([]);
      const controller = getController();
      const req = makeReq();
      const res = makeRes();

      await controller.getEngagementMetrics(req, res);

      expect(res.json).toHaveBeenCalledWith({
        engagement: {
          totalEvents: 0,
          totalAttendees: 0,
          averageSessionDuration: 0,
          averageInteractionRate: 0,
          events: [],
        },
      });
    });

    it('calculates session duration from startTime and endTime', async () => {
      mockEventFind([
        {
          _id: '1',
          title: 'A',
          type: 'Workshop',
          currentAttendees: 5,
          maxAttendees: 10,
          startTime: '2024-01-01T10:00:00Z',
          endTime: '2024-01-01T11:30:00Z',
        },
      ]);
      const controller = getController();
      const req = makeReq();
      const res = makeRes();

      await controller.getEngagementMetrics(req, res);

      const { engagement } = res.json.mock.calls[0][0];
      expect(engagement.events[0].averageSessionDuration).toBe(90);
      expect(engagement.events[0].interactionRate).toBe(50);
    });

    it('falls back to default duration by event type when times are missing', async () => {
      mockEventFind([
        { _id: '1', title: 'A', type: 'Webinar', currentAttendees: 0, maxAttendees: 0 },
      ]);
      const controller = getController();
      const req = makeReq();
      const res = makeRes();

      await controller.getEngagementMetrics(req, res);

      const { engagement } = res.json.mock.calls[0][0];
      expect(engagement.events[0].averageSessionDuration).toBe(90);
      expect(engagement.events[0].interactionRate).toBe(0);
    });

    it('falls back to 60 minute default for an unrecognized type', async () => {
      mockEventFind([
        { _id: '1', title: 'A', type: 'Mystery', currentAttendees: 0, maxAttendees: 0 },
      ]);
      const controller = getController();
      const req = makeReq();
      const res = makeRes();

      await controller.getEngagementMetrics(req, res);

      const { engagement } = res.json.mock.calls[0][0];
      expect(engagement.events[0].averageSessionDuration).toBe(60);
    });

    it('applies location filter only for allowed format values (security fix)', async () => {
      mockEventFind([]);
      const controller = getController();
      const req = makeReq({ format: 'Virtual' });
      const res = makeRes();

      await controller.getEngagementMetrics(req, res);

      const calledQuery = Event.find.mock.calls[0][0];
      expect(calledQuery.location).toBe('Virtual');
    });

    it('ignores a disallowed or malicious format value instead of injecting it', async () => {
      mockEventFind([]);
      const controller = getController();
      const req = makeReq({ format: { $ne: null } });
      const res = makeRes();

      await controller.getEngagementMetrics(req, res);

      const calledQuery = Event.find.mock.calls[0][0];
      expect(calledQuery.location).toBeUndefined();
    });

    it('ignores a format value that is not in the allowed list', async () => {
      mockEventFind([]);
      const controller = getController();
      const req = makeReq({ format: 'NotAFormat' });
      const res = makeRes();

      await controller.getEngagementMetrics(req, res);

      const calledQuery = Event.find.mock.calls[0][0];
      expect(calledQuery.location).toBeUndefined();
    });

    it('returns 500 on database error', async () => {
      Event.find.mockImplementation(() => {
        throw new Error('DB failure');
      });
      const controller = getController();
      const req = makeReq();
      const res = makeRes();

      await controller.getEngagementMetrics(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Failed to fetch engagement metrics' }),
      );
    });
  });

  describe('getEventValue', () => {
    it('returns zeroed values when there are no events', async () => {
      mockEventFind([]);
      const controller = getController();
      const req = makeReq();
      const res = makeRes();

      await controller.getEventValue(req, res);

      expect(res.json).toHaveBeenCalledWith({
        eventValues: {
          totalValue: 0,
          averageValuePerEvent: 0,
          events: [],
        },
      });
    });

    it('calculates estimated value using type-specific base values', async () => {
      mockEventFind([
        { _id: '1', title: 'A', type: 'Workshop', currentAttendees: 10 },
        { _id: '2', title: 'B', type: 'Meeting', currentAttendees: 5 },
      ]);
      const controller = getController();
      const req = makeReq();
      const res = makeRes();

      await controller.getEventValue(req, res);

      const { eventValues } = res.json.mock.calls[0][0];
      expect(eventValues.events[0].estimatedValue).toBe(500); // 10 * 50
      expect(eventValues.events[1].estimatedValue).toBe(150); // 5 * 30
      expect(eventValues.totalValue).toBe(650);
    });

    it('falls back to a base value of 30 for an unrecognized type', async () => {
      mockEventFind([{ _id: '1', title: 'A', type: 'Mystery', currentAttendees: 4 }]);
      const controller = getController();
      const req = makeReq();
      const res = makeRes();

      await controller.getEventValue(req, res);

      const { eventValues } = res.json.mock.calls[0][0];
      expect(eventValues.events[0].baseValuePerAttendee).toBe(30);
      expect(eventValues.events[0].estimatedValue).toBe(120);
    });

    it('returns 500 on database error', async () => {
      Event.find.mockImplementation(() => {
        throw new Error('DB failure');
      });
      const controller = getController();
      const req = makeReq();
      const res = makeRes();

      await controller.getEventValue(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Failed to fetch event values' }),
      );
    });
  });

  describe('getFormatComparison', () => {
    it('returns metrics for both virtual and in-person events', async () => {
      Event.find.mockImplementation((query) => {
        if (query.location === 'Virtual') {
          return {
            lean: jest.fn().mockResolvedValue([{ currentAttendees: 10 }, { currentAttendees: 20 }]),
          };
        }
        return { lean: jest.fn().mockResolvedValue([{ currentAttendees: 5 }]) };
      });
      const controller = getController();
      const req = makeReq();
      const res = makeRes();

      await controller.getFormatComparison(req, res);

      const { comparison } = res.json.mock.calls[0][0];
      expect(comparison.virtual).toEqual({
        totalEvents: 2,
        totalAttendees: 30,
        averageAttendeesPerEvent: 15,
      });
      expect(comparison.inPerson).toEqual({
        totalEvents: 1,
        totalAttendees: 5,
        averageAttendeesPerEvent: 5,
      });
    });

    it('applies date filters to both virtual and in-person queries', async () => {
      mockEventFind([]);
      const controller = getController();
      const req = makeReq({ startDate: '2024-01-01', endDate: '2024-01-31' });
      const res = makeRes();

      await controller.getFormatComparison(req, res);

      const virtualQuery = Event.find.mock.calls[0][0];
      const inPersonQuery = Event.find.mock.calls[1][0];
      expect(virtualQuery.date.$gte).toEqual(new Date('2024-01-01'));
      expect(inPersonQuery.date.$lte).toEqual(new Date('2024-01-31'));
    });

    it('returns 500 on database error', async () => {
      Event.find.mockImplementation(() => {
        throw new Error('DB failure');
      });
      const controller = getController();
      const req = makeReq();
      const res = makeRes();

      await controller.getFormatComparison(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Failed to fetch format comparison' }),
      );
    });
  });
});
