jest.mock('../services/analyticsService');

const analyticsService = require('../services/analyticsService');
const { getOverview, getStudentMetrics, refreshStudentMetrics } = require('./analyticsController');

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

  test('GET overview passes validated filters with an inclusive end date', async () => {
    const res = response();
    analyticsService.getOverview.mockResolvedValue({ totalStudents: 1 });

    await getOverview(
      {
        query: {
          studentId: 'student-1',
          classId: 'group-1',
          startDate: '2026-09-02',
          endDate: '2026-09-02',
        },
      },
      res,
    );

    expect(analyticsService.getOverview).toHaveBeenCalledWith({
      studentId: 'student-1',
      classId: 'group-1',
      startDate: new Date('2026-09-02T00:00:00.000Z'),
      endDate: new Date('2026-09-02T23:59:59.999Z'),
    });
    expect(res.json).toHaveBeenCalledWith({ totalStudents: 1 });
  });

  test.each(['not-a-date', '2026-02-30', '09-02-2026'])(
    'GET overview rejects invalid date %s',
    async (startDate) => {
      const res = response();

      await getOverview({ query: { startDate } }, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(analyticsService.getOverview).not.toHaveBeenCalled();
    },
  );

  test('GET overview rejects reversed date ranges', async () => {
    const res = response();

    await getOverview({ query: { startDate: '2026-09-03', endDate: '2026-09-02' } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(analyticsService.getOverview).not.toHaveBeenCalled();
  });
});
