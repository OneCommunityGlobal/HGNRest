jest.mock('../services/analyticsService');

const analyticsService = require('../services/analyticsService');
const { getStudentMetrics, refreshStudentMetrics } = require('./analyticsController');

const response = () => ({
  set: jest.fn(),
  json: jest.fn(),
  status: jest.fn().mockReturnThis(),
});

describe('analyticsController student metrics', () => {
  beforeEach(() => jest.clearAllMocks());

  test('GET returns metrics without calling the persistent refresh path', async () => {
    const res = response();
    analyticsService.getStudentMetrics.mockResolvedValue({ averageScore: 90 });

    await getStudentMetrics({ params: { studentId: 'student-1' }, query: {} }, res);

    expect(analyticsService.getStudentMetrics).toHaveBeenCalledWith('student-1', {
      forceRefresh: false,
    });
    expect(res.json).toHaveBeenCalledWith({
      studentId: 'student-1',
      metrics: { averageScore: 90 },
    });
    expect(analyticsService.refreshStudentMetrics).not.toHaveBeenCalled();
  });

  test('POST refresh returns explicitly persisted metrics', async () => {
    const res = response();
    analyticsService.refreshStudentMetrics.mockResolvedValue({ averageScore: 95 });

    await refreshStudentMetrics({ params: { studentId: 'student-1' } }, res);

    expect(analyticsService.refreshStudentMetrics).toHaveBeenCalledWith('student-1');
    expect(res.json).toHaveBeenCalledWith({
      studentId: 'student-1',
      metrics: { averageScore: 95 },
    });
  });
});
