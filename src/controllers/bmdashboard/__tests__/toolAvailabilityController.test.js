const toolAvailabilityController = require('../toolAvailabilityController');

const VALID_PROJECT_ID = '507f1f77bcf86cd799439011';
const INVALID_PROJECT_ID = 'not-a-valid-id';

const makeReq = ({ params = {}, query = {} } = {}) => ({ params, query });
const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
});

const getMatchStage = (aggregateMock) => aggregateMock.mock.calls[0][0][0].$match;

describe('toolAvailabilityController', () => {
  let ToolAvailability;
  let controller;
  let consoleErrorSpy;

  beforeEach(() => {
    ToolAvailability = { aggregate: jest.fn() };
    controller = toolAvailabilityController(ToolAvailability);
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('getToolsAvailability', () => {
    it('returns 400 when the project id is not a valid ObjectId', async () => {
      const req = makeReq({ params: { id: INVALID_PROJECT_ID } });
      const res = makeRes();

      await controller.getToolsAvailability(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid project ID format' });
      expect(ToolAvailability.aggregate).not.toHaveBeenCalled();
    });

    it('queries without a date filter when no dates are provided', async () => {
      ToolAvailability.aggregate.mockResolvedValue([
        { toolName: 'Drill', inUse: 2, needsReplacement: 0, yetToReceive: 1 },
      ]);
      const req = makeReq({ params: { id: VALID_PROJECT_ID } });
      const res = makeRes();

      await controller.getToolsAvailability(req, res);

      const match = getMatchStage(ToolAvailability.aggregate);
      expect(match.date).toBeUndefined();
      expect(res.json).toHaveBeenCalledWith([
        { toolName: 'Drill', inUse: 2, needsReplacement: 0, yetToReceive: 1 },
      ]);
    });

    it('builds a date range filter when both startDate and endDate are provided', async () => {
      ToolAvailability.aggregate.mockResolvedValue([]);
      const req = makeReq({
        params: { id: VALID_PROJECT_ID },
        query: { startDate: '2026-01-01', endDate: '2026-01-31' },
      });
      const res = makeRes();

      await controller.getToolsAvailability(req, res);

      const match = getMatchStage(ToolAvailability.aggregate);
      expect(match.date.$gte).toEqual(new Date('2026-01-01'));
      expect(match.date.$lte).toEqual(new Date('2026-01-31T23:59:59.999Z'));
    });

    it('builds a lower-bound-only filter when only startDate is provided', async () => {
      ToolAvailability.aggregate.mockResolvedValue([]);
      const req = makeReq({
        params: { id: VALID_PROJECT_ID },
        query: { startDate: '2026-01-01' },
      });
      const res = makeRes();

      await controller.getToolsAvailability(req, res);

      const match = getMatchStage(ToolAvailability.aggregate);
      expect(match.date).toEqual({ $gte: new Date('2026-01-01') });
    });

    it('builds an upper-bound-only filter when only endDate is provided', async () => {
      ToolAvailability.aggregate.mockResolvedValue([]);
      const req = makeReq({
        params: { id: VALID_PROJECT_ID },
        query: { endDate: '2026-01-31' },
      });
      const res = makeRes();

      await controller.getToolsAvailability(req, res);

      const match = getMatchStage(ToolAvailability.aggregate);
      expect(match.date).toEqual({ $lte: new Date('2026-01-31T23:59:59.999Z') });
    });

    it('extends a date-only endDate to the end of that day so same-day records are included', async () => {
      // Regression test for a reported bug: a date-only endDate was interpreted as
      // midnight, excluding records timestamped later that same day (e.g. a unit
      // recorded at noon on the selected end day was dropped from the results).
      ToolAvailability.aggregate.mockResolvedValue([]);
      const req = makeReq({
        params: { id: VALID_PROJECT_ID },
        query: { startDate: '2026-10-05', endDate: '2026-10-05' },
      });
      const res = makeRes();

      await controller.getToolsAvailability(req, res);

      const match = getMatchStage(ToolAvailability.aggregate);
      expect(match.date.$lte).toEqual(new Date('2026-10-05T23:59:59.999Z'));
      expect(match.date.$lte.getTime()).toBeGreaterThan(
        new Date('2026-10-05T12:00:00.000Z').getTime(),
      );
    });

    it('does not modify an endDate that already has an explicit timestamp', async () => {
      ToolAvailability.aggregate.mockResolvedValue([]);
      const req = makeReq({
        params: { id: VALID_PROJECT_ID },
        query: { endDate: '2026-10-05T23:59:59.999Z' },
      });
      const res = makeRes();

      await controller.getToolsAvailability(req, res);

      const match = getMatchStage(ToolAvailability.aggregate);
      expect(match.date).toEqual({ $lte: new Date('2026-10-05T23:59:59.999Z') });
    });

    it('returns an empty array when aggregate resolves with no results', async () => {
      ToolAvailability.aggregate.mockResolvedValue([]);
      const req = makeReq({ params: { id: VALID_PROJECT_ID } });
      const res = makeRes();

      await controller.getToolsAvailability(req, res);

      expect(res.json).toHaveBeenCalledWith([]);
    });

    it('returns an empty array when aggregate resolves with a falsy value', async () => {
      ToolAvailability.aggregate.mockResolvedValue(null);
      const req = makeReq({ params: { id: VALID_PROJECT_ID } });
      const res = makeRes();

      await controller.getToolsAvailability(req, res);

      expect(res.json).toHaveBeenCalledWith([]);
    });

    it('returns 500 and logs the error when aggregate throws', async () => {
      ToolAvailability.aggregate.mockRejectedValue(new Error('DB failure'));
      const req = makeReq({ params: { id: VALID_PROJECT_ID } });
      const res = makeRes();

      await controller.getToolsAvailability(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error fetching tools availability:',
        expect.any(Error),
      );
    });
  });

  describe('getUniqueProjectIds', () => {
    it('returns projects with their resolved names', async () => {
      ToolAvailability.aggregate.mockResolvedValue([
        { _id: VALID_PROJECT_ID, projectName: 'Building 3' },
      ]);
      const req = makeReq();
      const res = makeRes();

      await controller.getUniqueProjectIds(req, res);

      expect(res.json).toHaveBeenCalledWith([
        { projectId: VALID_PROJECT_ID, projectName: 'Building 3' },
      ]);
    });

    it('falls back to null when no matching project name is found', async () => {
      ToolAvailability.aggregate.mockResolvedValue([
        { _id: VALID_PROJECT_ID, projectName: undefined },
      ]);
      const req = makeReq();
      const res = makeRes();

      await controller.getUniqueProjectIds(req, res);

      expect(res.json).toHaveBeenCalledWith([{ projectId: VALID_PROJECT_ID, projectName: null }]);
    });

    it('returns an empty array when there are no tool availability records', async () => {
      ToolAvailability.aggregate.mockResolvedValue([]);
      const req = makeReq();
      const res = makeRes();

      await controller.getUniqueProjectIds(req, res);

      expect(res.json).toHaveBeenCalledWith([]);
    });

    it('returns 500 and logs the error when aggregate throws', async () => {
      ToolAvailability.aggregate.mockRejectedValue(new Error('DB failure'));
      const req = makeReq();
      const res = makeRes();

      await controller.getUniqueProjectIds(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error fetching unique project IDs:',
        expect.any(Error),
      );
    });
  });
});
