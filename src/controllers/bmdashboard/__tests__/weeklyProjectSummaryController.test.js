jest.mock('../../../services/bmdashboard/weeklyProjectSummaryService', () => ({
  getWeeklyProjectSummaryProjectStatus: jest.fn(),
}));
jest.mock('../../../startup/logger', () => ({
  logException: jest.fn().mockReturnValue('tracking-id'),
}));

const {
  getWeeklyProjectSummaryProjectStatus,
} = require('../../../services/bmdashboard/weeklyProjectSummaryService');
const logger = require('../../../startup/logger');
const controller = require('../weeklyProjectSummaryController');

const VALID_PROJECT_ID = '507f1f77bcf86cd799439011';

function makeReq(query = {}) {
  return { query };
}

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe('weeklyProjectSummaryController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 200 for a valid current-period request', async () => {
    const payload = { current: { metrics: {} }, comparison: null };
    getWeeklyProjectSummaryProjectStatus.mockResolvedValue(payload);
    const req = makeReq({ startDate: '2026-08-30', endDate: '2026-09-05' });
    const res = makeRes();

    await controller.getProjectStatus(req, res);

    expect(getWeeklyProjectSummaryProjectStatus).toHaveBeenCalledWith(req.query);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(payload);
  });

  test('accepts a valid current + comparison request', async () => {
    getWeeklyProjectSummaryProjectStatus.mockResolvedValue({ ok: true });
    const req = makeReq({
      startDate: '2026-08-30',
      endDate: '2026-09-05',
      comparisonStartDate: '2026-08-23',
      comparisonEndDate: '2026-08-29',
      projectId: VALID_PROJECT_ID,
    });
    const res = makeRes();

    await controller.getProjectStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test.each([
    [{ endDate: '2026-09-05' }, 'startDate is required'],
    [{ startDate: '2026-08-30' }, 'endDate is required'],
    [{ startDate: 'bad', endDate: '2026-09-05' }, 'startDate must be YYYY-MM-DD'],
    [
      { startDate: '2026-09-05', endDate: '2026-08-30' },
      'startDate must be before or equal to endDate',
    ],
    [
      { startDate: '2026-08-30', endDate: '2026-09-05', comparisonStartDate: '2026-08-23' },
      'comparisonStartDate and comparisonEndDate must be supplied together',
    ],
    [
      {
        startDate: '2026-08-30',
        endDate: '2026-09-05',
        comparisonStartDate: '2026-08-29',
        comparisonEndDate: '2026-08-23',
      },
      'comparisonStartDate must be before or equal to comparisonEndDate',
    ],
    [
      { startDate: '2026-08-30', endDate: '2026-09-05', projectId: 'bad-id' },
      'projectId must be a valid ObjectId or "all"',
    ],
  ])('returns 400 for invalid query %#', async (query, message) => {
    const req = makeReq(query);
    const res = makeRes();

    await controller.getProjectStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Validation Error', message });
    expect(getWeeklyProjectSummaryProjectStatus).not.toHaveBeenCalled();
  });

  test('returns 404 when service reports nonexistent project', async () => {
    getWeeklyProjectSummaryProjectStatus.mockRejectedValue(
      Object.assign(new Error('Building project not found'), { status: 404 }),
    );
    const req = makeReq({
      startDate: '2026-08-30',
      endDate: '2026-09-05',
      projectId: VALID_PROJECT_ID,
    });
    const res = makeRes();

    await controller.getProjectStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Not Found',
      message: 'Building project not found',
    });
  });

  test('logs and returns 500 for unexpected errors', async () => {
    const error = new Error('boom');
    getWeeklyProjectSummaryProjectStatus.mockRejectedValue(error);
    const req = makeReq({ startDate: '2026-08-30', endDate: '2026-09-05' });
    const res = makeRes();

    await controller.getProjectStatus(req, res);

    expect(logger.logException).toHaveBeenCalledWith(
      error,
      'weeklyProjectSummaryController.getProjectStatus',
      { endpoint: '/weekly-project-summary/project-status', query: req.query },
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
