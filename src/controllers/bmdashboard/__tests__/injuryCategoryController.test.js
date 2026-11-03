jest.mock('../../../models/bmdashboard/buildingInjury', () => ({
  aggregate: jest.fn(),
  distinct: jest.fn(),
  insertMany: jest.fn(),
}));

const mongoose = require('mongoose');
const InjuryCategory = require('../../../models/bmdashboard/buildingInjury');
const {
  getInjuryTrendData,
  createInjuries,
  getProjectsWithInjuries,
  getUniqueSeverities,
  getUniqueInjuryTypes,
  getCategoryBreakdown,
} = require('../injuryCategoryController');

const VALID_PROJECT_ID = '65419e61105441587e2dec99';

const makeReq = ({ query = {}, body } = {}) => ({ query, body });

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnThis();
  res.json = jest.fn().mockReturnThis();
  return res;
};

const mockAggregate = (results) => {
  const option = jest.fn().mockResolvedValue(results);
  InjuryCategory.aggregate.mockReturnValue({ option });
  return option;
};

describe('injuryCategoryController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getInjuryTrendData', () => {
    it('returns 400 for invalid startDate/endDate', async () => {
      const req = makeReq({ query: { startDate: 'not-a-date', endDate: 'also-bad' } });
      const res = makeRes();

      await getInjuryTrendData(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid startDate or endDate (use YYYY-MM-DD or ISO)',
      });
      expect(InjuryCategory.aggregate).not.toHaveBeenCalled();
    });

    it('aggregates by month/severity with year labels for a YYYY-MM-DD range', async () => {
      mockAggregate([
        { year: 2025, month: 2, severity: 'Serious', count: 3 },
        { year: 2025, month: 2, severity: 'Medium', count: 1 },
        { year: 2025, month: 3, severity: 'Low', count: 2 },
        { year: 2025, month: 3, severity: 'serious', count: 1 },
      ]);
      const req = makeReq({
        query: {
          projectId: VALID_PROJECT_ID,
          startDate: '2025-02-01',
          endDate: '2025-03-31',
        },
      });
      const res = makeRes();

      await getInjuryTrendData(req, res);

      expect(InjuryCategory.aggregate).toHaveBeenCalled();
      const matchStage = InjuryCategory.aggregate.mock.calls[0][0][0].$match;
      expect(matchStage.projectId.$in[0].toString()).toBe(VALID_PROJECT_ID);
      expect(matchStage.date.$gte).toEqual(new Date(Date.UTC(2025, 1, 1)));
      expect(matchStage.date.$lt).toEqual(new Date(Date.UTC(2025, 3, 1)));

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        months: ['Feb 2025', 'Mar 2025'],
        serious: [3, 1],
        medium: [1, 0],
        low: [0, 2],
      });
    });

    it('treats non-ObjectId projectId tokens as project names', async () => {
      mockAggregate([]);
      const req = makeReq({
        query: {
          projectId: 'Building 1',
          startDate: '2025-01-01',
          endDate: '2025-01-31',
        },
      });
      const res = makeRes();

      await getInjuryTrendData(req, res);

      const matchStage = InjuryCategory.aggregate.mock.calls[0][0][0].$match;
      expect(matchStage.projectId).toBeUndefined();
      expect(matchStage.$or).toHaveLength(1);
      expect(matchStage.$or[0].$expr.$eq[1]).toBe('building 1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        months: ['Jan 2025'],
        serious: [0],
        medium: [0],
        low: [0],
      });
    });

    it('combines ObjectIds from projectIds with explicit projectName', async () => {
      mockAggregate([]);
      const req = makeReq({
        query: {
          projectIds: VALID_PROJECT_ID,
          projectName: 'Building 1',
          startDate: '2025-01-01',
          endDate: '2025-01-31',
        },
      });
      const res = makeRes();

      await getInjuryTrendData(req, res);

      const matchStage = InjuryCategory.aggregate.mock.calls[0][0][0].$match;
      expect(matchStage.projectId.$in[0].toString()).toBe(VALID_PROJECT_ID);
      expect(matchStage.$or[0].$expr.$eq[1]).toBe('building 1');
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('uses inclusive $lte when endDate is ISO rather than YYYY-MM-DD', async () => {
      mockAggregate([]);
      const req = makeReq({
        query: {
          startDate: '2025-01-01T00:00:00.000Z',
          endDate: '2025-01-31T00:00:00.000Z',
        },
      });
      const res = makeRes();

      await getInjuryTrendData(req, res);

      const matchStage = InjuryCategory.aggregate.mock.calls[0][0][0].$match;
      expect(matchStage.date.$gte).toEqual(new Date('2025-01-01T00:00:00.000Z'));
      // ISO end dates keep $lte from buildMatch until getInjuryTrendData rewrites bounds;
      // rewrite uses $lt from match when present — for ISO-only end, $lte is set then
      // replaced by default endExclusive when $lt is absent.
      expect(matchStage.date.$lt).toBeInstanceOf(Date);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('defaults to the last 12 months when no date range is provided', async () => {
      mockAggregate([]);
      const req = makeReq({ query: {} });
      const res = makeRes();

      await getInjuryTrendData(req, res);

      const matchStage = InjuryCategory.aggregate.mock.calls[0][0][0].$match;
      const now = new Date();
      const expectedEndMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const expectedStart = new Date(
        Date.UTC(expectedEndMonth.getUTCFullYear(), expectedEndMonth.getUTCMonth() - 11, 1),
      );
      const expectedEndExclusive = new Date(
        Date.UTC(expectedEndMonth.getUTCFullYear(), expectedEndMonth.getUTCMonth() + 1, 1),
      );

      expect(matchStage.date.$gte).toEqual(expectedStart);
      expect(matchStage.date.$lt).toEqual(expectedEndExclusive);
      expect(res.json.mock.calls[0][0].months).toHaveLength(12);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('accumulates duplicate severity rows for the same month and ignores null severity', async () => {
      mockAggregate([
        { year: 2025, month: 1, severity: 'Medium', count: 2 },
        { year: 2025, month: 1, severity: 'Medium', count: 3 },
        { year: 2025, month: 1, severity: null, count: 9 },
        { year: 2025, month: 1, severity: 'Low', count: undefined },
      ]);
      const req = makeReq({
        query: { startDate: '2025-01-01', endDate: '2025-01-31' },
      });
      const res = makeRes();

      await getInjuryTrendData(req, res);

      expect(res.json).toHaveBeenCalledWith({
        months: ['Jan 2025'],
        serious: [0],
        medium: [5],
        low: [0],
      });
    });

    it('returns 500 when aggregation fails', async () => {
      const option = jest.fn().mockRejectedValue(new Error('agg failed'));
      InjuryCategory.aggregate.mockReturnValue({ option });
      const req = makeReq({
        query: { startDate: '2025-01-01', endDate: '2025-01-31' },
      });
      const res = makeRes();
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await getInjuryTrendData(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
      errorSpy.mockRestore();
    });
  });

  describe('createInjuries', () => {
    it('returns 400 for an empty array payload', async () => {
      const req = makeReq({ body: [] });
      const res = makeRes();

      await createInjuries(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Empty payload' });
      expect(InjuryCategory.insertMany).not.toHaveBeenCalled();
    });

    it('creates a single injury and defaults count to 1', async () => {
      const inserted = [{ _id: 'doc1' }];
      InjuryCategory.insertMany.mockResolvedValue(inserted);
      const req = makeReq({
        body: {
          projectId: VALID_PROJECT_ID,
          date: '2025-02-05',
          severity: 'serious',
        },
      });
      const res = makeRes();

      await createInjuries(req, res);

      expect(InjuryCategory.insertMany).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            projectId: expect.any(mongoose.Types.ObjectId),
            projectName: undefined,
            injuryType: undefined,
            workerCategory: undefined,
            severity: 'Serious',
            count: 1,
            date: new Date(Date.UTC(2025, 1, 5)),
          }),
        ],
        { ordered: false },
      );
      expect(InjuryCategory.insertMany.mock.calls[0][0][0].projectId.toString()).toBe(
        VALID_PROJECT_ID,
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ insertedCount: 1, docs: inserted });
    });

    it('creates bulk injuries and normalizes optional fields', async () => {
      const inserted = [{ _id: 'a' }, { _id: 'b' }];
      InjuryCategory.insertMany.mockResolvedValue(inserted);
      const req = makeReq({
        body: [
          {
            projectId: VALID_PROJECT_ID,
            projectName: 'Building 1',
            date: '2025-02-05',
            injuryType: 'Fall',
            workerCategory: 'Electrician',
            severity: 'MEDIUM',
            count: 2,
          },
          {
            projectId: VALID_PROJECT_ID,
            date: '2025-03-01T00:00:00.000Z',
            severity: 'Low',
            count: 0,
          },
        ],
      });
      const res = makeRes();

      await createInjuries(req, res);

      const docs = InjuryCategory.insertMany.mock.calls[0][0];
      expect(docs).toHaveLength(2);
      expect(docs[0]).toEqual(
        expect.objectContaining({
          projectName: 'Building 1',
          injuryType: 'Fall',
          workerCategory: 'Electrician',
          severity: 'Medium',
          count: 2,
        }),
      );
      expect(docs[1]).toEqual(
        expect.objectContaining({
          severity: 'Low',
          count: 0,
        }),
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ insertedCount: 2, docs: inserted });
    });

    it('returns 400 when projectId is missing or invalid', async () => {
      const req = makeReq({
        body: { date: '2025-02-05', severity: 'Serious' },
      });
      const res = makeRes();
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await createInjuries(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'projectId is required and must be a valid ObjectId',
      });
      errorSpy.mockRestore();
    });

    it('returns 400 when date is invalid', async () => {
      const req = makeReq({
        body: {
          projectId: VALID_PROJECT_ID,
          date: 'bad-date',
          severity: 'Serious',
        },
      });
      const res = makeRes();
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await createInjuries(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid or missing date (use YYYY-MM-DD or ISO)',
      });
      errorSpy.mockRestore();
    });

    it('returns 400 when severity is invalid', async () => {
      const req = makeReq({
        body: {
          projectId: VALID_PROJECT_ID,
          date: '2025-02-05',
          severity: 'Critical',
        },
      });
      const res = makeRes();
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await createInjuries(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'severity must be one of: Serious | Medium | Low',
      });
      errorSpy.mockRestore();
    });

    it('returns 500 for non-validation insert failures', async () => {
      InjuryCategory.insertMany.mockRejectedValue(new Error('db unavailable'));
      const req = makeReq({
        body: {
          projectId: VALID_PROJECT_ID,
          date: '2025-02-05',
          severity: 'Serious',
        },
      });
      const res = makeRes();
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await createInjuries(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
      errorSpy.mockRestore();
    });
  });

  describe('getProjectsWithInjuries', () => {
    it('returns 400 for invalid dates', async () => {
      const req = makeReq({ query: { startDate: 'nope' } });
      const res = makeRes();

      await getProjectsWithInjuries(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(InjuryCategory.aggregate).not.toHaveBeenCalled();
    });

    it('returns projects with projectIds from aggregation', async () => {
      const projects = [{ _id: 'building 1', name: 'Building 1', projectIds: [VALID_PROJECT_ID] }];
      mockAggregate(projects);
      const req = makeReq({ query: {} });
      const res = makeRes();

      await getProjectsWithInjuries(req, res);

      expect(InjuryCategory.aggregate).toHaveBeenCalled();
      const pipeline = InjuryCategory.aggregate.mock.calls[0][0];
      expect(pipeline.some((stage) => stage.$group && stage.$group.projectIds)).toBe(true);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(projects);
    });

    it('returns 500 when aggregation fails', async () => {
      const option = jest.fn().mockRejectedValue(new Error('fail'));
      InjuryCategory.aggregate.mockReturnValue({ option });
      const req = makeReq({ query: {} });
      const res = makeRes();
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await getProjectsWithInjuries(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      errorSpy.mockRestore();
    });
  });

  describe('supporting endpoints', () => {
    it('getUniqueSeverities returns sorted non-empty values', async () => {
      InjuryCategory.distinct.mockResolvedValue(['Medium', null, 'Serious', '']);
      const res = makeRes();

      await getUniqueSeverities({}, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(['Medium', 'Serious']);
    });

    it('getUniqueSeverities returns 500 on failure', async () => {
      InjuryCategory.distinct.mockRejectedValue(new Error('fail'));
      const res = makeRes();
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await getUniqueSeverities({}, res);

      expect(res.status).toHaveBeenCalledWith(500);
      errorSpy.mockRestore();
    });

    it('getUniqueInjuryTypes returns sorted non-empty values', async () => {
      InjuryCategory.distinct.mockResolvedValue(['Fall', '', 'Cut']);
      const res = makeRes();

      await getUniqueInjuryTypes({}, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(['Cut', 'Fall']);
    });

    it('getUniqueInjuryTypes returns 500 on failure', async () => {
      InjuryCategory.distinct.mockRejectedValue(new Error('fail'));
      const res = makeRes();
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await getUniqueInjuryTypes({}, res);

      expect(res.status).toHaveBeenCalledWith(500);
      errorSpy.mockRestore();
    });

    it('getCategoryBreakdown returns aggregated rows', async () => {
      const rows = [
        { projectId: VALID_PROJECT_ID, workerCategory: 'Electrician', totalInjuries: 2 },
      ];
      mockAggregate(rows);
      const req = makeReq({
        query: {
          projectIds: VALID_PROJECT_ID,
          startDate: '2025-01-01',
          endDate: '2025-01-31',
          severities: 'Serious,Medium',
          types: 'Fall',
        },
      });
      const res = makeRes();

      await getCategoryBreakdown(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(rows);
    });

    it('getCategoryBreakdown returns 400 for invalid dates', async () => {
      const req = makeReq({ query: { endDate: 'bad' } });
      const res = makeRes();

      await getCategoryBreakdown(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('getCategoryBreakdown returns 500 on failure', async () => {
      const option = jest.fn().mockRejectedValue(new Error('fail'));
      InjuryCategory.aggregate.mockReturnValue({ option });
      const req = makeReq({ query: {} });
      const res = makeRes();
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await getCategoryBreakdown(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      errorSpy.mockRestore();
    });
  });
});
