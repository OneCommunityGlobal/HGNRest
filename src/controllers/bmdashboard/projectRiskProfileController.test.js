// v1.1.0
jest.mock('../../models/bmdashboard/projectRiskProfile');
jest.mock('../../models/bmdashboard/Issues');
jest.mock('../../models/bmdashboard/projectRiskObservation');

const ProjectRiskProfile = require('../../models/bmdashboard/projectRiskProfile');
const Issue = require('../../models/bmdashboard/Issues');
const Observation = require('../../models/bmdashboard/projectRiskObservation');
const controller = require('./projectRiskProfileController');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const leanResult = (value) => ({ lean: jest.fn().mockResolvedValue(value) });

const baseProfile = (overrides = {}) => ({
  projectId: 'project-1',
  issues: [],
  startDate: new Date('2025-01-01T00:00:00Z'),
  endDate: new Date('2025-12-31T00:00:00Z'),
  initialCostEstimate: 100,
  currentCostIncurred: 50,
  ...overrides,
});

describe('projectRiskProfileController.getRiskProfileSummary - issue counts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Observation.find.mockReturnValue({ sort: () => leanResult([]) });
    Issue.findById.mockReturnValue(leanResult({ projectName: 'Project X' }));
  });

  test('without a time range, sums the project issue record with no date filter', async () => {
    ProjectRiskProfile.find.mockReturnValue(leanResult([baseProfile()]));
    Issue.find.mockReturnValue(
      leanResult([{ equipmentIssues: 1, laborIssues: 2, materialIssues: 3 }]),
    );
    const res = mockRes();

    await controller.getRiskProfileSummary({ query: {} }, res);

    expect(Issue.find).toHaveBeenCalledWith({ _id: { $in: ['project-1'] } });
    expect(res.status).toHaveBeenCalledWith(200);
    const [result] = res.json.mock.calls[0][0];
    expect(result.projectName).toBe('Project X');
    expect(result.totalOpenIssues).toBe(6);
  });

  test('with startDate/endDate, counts only issue records created in that range', async () => {
    ProjectRiskProfile.find.mockReturnValue(
      leanResult([baseProfile({ issues: ['issue-1', 'issue-2'] })]),
    );
    Issue.find.mockReturnValue(
      leanResult([
        { equipmentIssues: 2, laborIssues: 0, materialIssues: 1 },
        { equipmentIssues: 0, laborIssues: 4, materialIssues: 0 },
      ]),
    );
    const res = mockRes();

    await controller.getRiskProfileSummary(
      { query: { startDate: '2026-01-01', endDate: '2026-01-31' } },
      res,
    );

    const query = Issue.find.mock.calls[0][0];
    expect(query._id).toEqual({ $in: ['issue-1', 'issue-2'] });
    expect(query.createdAt.$gte.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(query.createdAt.$lte.toISOString()).toBe('2026-01-31T23:59:59.999Z');
    expect(res.json.mock.calls[0][0][0].totalOpenIssues).toBe(7);
  });

  test('ignores invalid dates and treats missing counts as zero', async () => {
    ProjectRiskProfile.find.mockReturnValue(leanResult([baseProfile()]));
    Issue.find.mockReturnValue(leanResult([{ laborIssues: 5 }]));
    const res = mockRes();

    await controller.getRiskProfileSummary(
      { query: { startDate: 'not-a-date', endDate: 'also-bad' } },
      res,
    );

    const query = Issue.find.mock.calls[0][0];
    expect(query.createdAt).toBeUndefined();
    expect(res.json.mock.calls[0][0][0].totalOpenIssues).toBe(5);
  });

  test('applies only the start bound when just startDate is given', async () => {
    ProjectRiskProfile.find.mockReturnValue(leanResult([baseProfile()]));
    Issue.find.mockReturnValue(leanResult([]));
    const res = mockRes();

    await controller.getRiskProfileSummary({ query: { startDate: '2026-03-01' } }, res);

    const query = Issue.find.mock.calls[0][0];
    expect(query.createdAt.$gte.toISOString()).toBe('2026-03-01T00:00:00.000Z');
    expect(query.createdAt.$lte).toBeUndefined();
    expect(res.json.mock.calls[0][0][0].totalOpenIssues).toBe(0);
  });

  test('returns 500 when loading risk profiles fails', async () => {
    ProjectRiskProfile.find.mockReturnValue({
      lean: jest.fn().mockRejectedValue(new Error('db down')),
    });
    const res = mockRes();

    await controller.getRiskProfileSummary({ query: {} }, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'db down' });
  });

  test('forecasts on-budget spending at half of planned duration', async () => {
    const now = Date.now();
    ProjectRiskProfile.find.mockReturnValue(
      leanResult([
        baseProfile({
          status: 'active',
          startDate: new Date(now - 50 * 86400000),
          endDate: new Date(now + 50 * 86400000),
        }),
      ]),
    );
    Issue.find.mockReturnValue(leanResult([]));
    const res = mockRes();
    await controller.getRiskProfileSummary({ query: {} }, res);
    expect(res.json.mock.calls[0][0][0].predictedCostOverrun).toBeCloseTo(0, 2);
  });

  test('active overdue projects continue to accrue delay', async () => {
    const now = Date.now();
    ProjectRiskProfile.find.mockReturnValue(
      leanResult([
        baseProfile({
          status: 'active',
          startDate: new Date(now - 120 * 86400000),
          endDate: new Date(now - 20 * 86400000),
        }),
      ]),
    );
    Issue.find.mockReturnValue(leanResult([]));
    const res = mockRes();
    await controller.getRiskProfileSummary({ query: {} }, res);
    expect(res.json.mock.calls[0][0][0].predictedTimeDelay).toBeCloseTo(120, 2);
  });
});
