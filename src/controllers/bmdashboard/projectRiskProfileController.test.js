// v1.2.0
jest.mock('../../models/bmdashboard/projectRiskProfile');
jest.mock('../../models/bmdashboard/buildingProject');
jest.mock('../../models/bmdashboard/buildingIssue');
jest.mock('../../models/bmdashboard/projectRiskObservation');

const ProjectRiskProfile = require('../../models/bmdashboard/projectRiskProfile');
const BuildingProject = require('../../models/bmdashboard/buildingProject');
const BuildingIssue = require('../../models/bmdashboard/buildingIssue');
const Observation = require('../../models/bmdashboard/projectRiskObservation');
const controller = require('./projectRiskProfileController');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const projectId = '507f1f77bcf86cd799439011';
const leanResult = (value) => ({ lean: jest.fn().mockResolvedValue(value) });
const baseProfile = (overrides = {}) => ({
  _id: projectId,
  projectId,
  initialCostEstimate: 100,
  currentCostIncurred: 50,
  ...overrides,
});
const project = { _id: projectId, name: 'Earthbag Village', isActive: true };

function mockProjectQuery(projects = [project]) {
  BuildingProject.find.mockReturnValue({
    sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(projects) }),
  });
}

function mockProfileQuery(profiles = []) {
  ProjectRiskProfile.find.mockReturnValue({ lean: jest.fn().mockResolvedValue(profiles) });
}

function mockIssueQuery(issues = []) {
  BuildingIssue.find.mockReturnValue({
    select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(issues) }),
  });
}

describe('projectRiskProfileController.getRiskProfileSummary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Observation.find.mockReturnValue({ sort: () => leanResult([]) });
    mockProjectQuery();
    mockProfileQuery();
    mockIssueQuery();
  });

  test('returns actual building project names and excludes legacy sample issue names', async () => {
    const res = mockRes();
    await controller.getRiskProfileSummary({ query: {} }, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([
      expect.objectContaining({
        projectId,
        projectName: 'Earthbag Village',
        predictedCostOverrun: null,
        predictedTimeDelay: null,
      }),
    ]);
  });

  test('uses a real profile linked directly to a building project', async () => {
    mockProfileQuery([
      {
        projectId,
        startDate: new Date('2025-01-01T00:00:00Z'),
        endDate: new Date('2025-12-31T00:00:00Z'),
        initialCostEstimate: 1000,
        currentCostIncurred: 500,
        plannedTime: 365,
        actualTimeElapsed: 300,
      },
    ]);
    mockIssueQuery([{ projectId }, { projectId }]);
    const res = mockRes();

    await controller.getRiskProfileSummary({ query: {} }, res);

    const [result] = res.json.mock.calls[0][0];
    expect(result.projectName).toBe('Earthbag Village');
    expect(result.predictedCostOverrun).not.toBeNull();
    expect(result.predictedTimeDelay).toBeCloseTo((300 / 365) * 100);
    expect(result.totalOpenIssues).toBe(2);
  });

  test('filters real building issues by the selected date range', async () => {
    const res = mockRes();
    await controller.getRiskProfileSummary(
      { query: { startDate: '2026-01-01', endDate: '2026-01-31' } },
      res,
    );
    const issueQuery = BuildingIssue.find.mock.calls[0][0];
    expect(issueQuery.status).toEqual({ $ne: 'closed' });
    expect(issueQuery.issueDate.$gte.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(issueQuery.issueDate.$lte.toISOString()).toBe('2026-01-31T23:59:59.999Z');
  });

  test('applies the project filter to building project IDs', async () => {
    const res = mockRes();
    await controller.getRiskProfileSummary({ query: { projects: projectId } }, res);
    expect(BuildingProject.find).toHaveBeenCalledWith({
      isActive: { $ne: false },
      _id: { $in: [projectId] },
    });
  });

  test('returns 500 when loading building projects fails', async () => {
    BuildingProject.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockRejectedValue(new Error('db down')),
      }),
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
    const res = mockRes();
    await controller.getRiskProfileSummary({ query: {} }, res);
    expect(res.json.mock.calls[0][0][0].predictedTimeDelay).toBeCloseTo(120, 2);
  });
});
