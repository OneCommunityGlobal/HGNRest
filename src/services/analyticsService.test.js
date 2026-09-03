jest.mock('../models/studentMetrics');
jest.mock('../models/formResponse');

const StudentMetrics = require('../models/studentMetrics');
const FormResponse = require('../models/formResponse');
const {
  parseAnalyticsNumber,
  calculateStudentMetrics,
  refreshStudentMetrics,
  computeStudentMetrics,
  getStudentMetrics,
} = require('./analyticsService');

const responseQuery = (responses) => ({
  lean: jest.fn().mockResolvedValue(responses),
});

describe('analyticsService student metrics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    StudentMetrics.findOneAndUpdate.mockResolvedValue({});
  });

  describe('parseAnalyticsNumber', () => {
    test.each([
      [85, 85],
      ['12.5', 12.5],
    ])('accepts %p', (value, expected) => {
      expect(parseAnalyticsNumber(value)).toBe(expected);
    });

    test.each([null, undefined, '', '  ', 'not-a-number', NaN, Infinity, -Infinity])(
      'rejects %p',
      (value) => {
        expect(parseAnalyticsNumber(value)).toBeNull();
      },
    );
  });

  test('calculates sanitized metrics from malformed responses without NaN', async () => {
    FormResponse.find.mockReturnValue(
      responseQuery([
        {
          responses: [
            { answer: null },
            {},
            { answer: '' },
            { answer: '  ' },
            { answer: '85' },
            { answer: 'invalid' },
            { answer: Infinity },
            null,
            { questionLabel: 'Time Spent', answer: '12.5' },
          ],
          timeSpentMinutes: 'invalid',
        },
        { responses: null, timeSpentMinutes: NaN },
        { responses: 'invalid', timeSpentMinutes: '3' },
      ]),
    );

    const metrics = await calculateStudentMetrics('student-1');

    expect(metrics).toEqual({
      averageScore: 48.75,
      totalTimeSpentMinutes: 16,
      engagementRate: 0.3,
      completionRate: 33.3,
      assessmentsTaken: 3,
    });
    expect(Object.values(metrics).every(Number.isFinite)).toBe(true);
  });

  test('GET service returns fresh metrics without writing when cache is missing', async () => {
    StudentMetrics.findOne.mockReturnValue(responseQuery(null));
    FormResponse.find.mockReturnValue(responseQuery([]));

    await getStudentMetrics('student-1');

    expect(StudentMetrics.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('GET service returns a fresh cache without writing', async () => {
    StudentMetrics.findOne.mockReturnValue(
      responseQuery({ metrics: { averageScore: 90 }, lastUpdated: new Date() }),
    );

    const result = await getStudentMetrics('student-1');

    expect(result).toEqual({ averageScore: 90 });
    expect(FormResponse.find).not.toHaveBeenCalled();
    expect(StudentMetrics.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test.each([
    ['stale cache', { metrics: { averageScore: 1 }, lastUpdated: new Date(0) }],
    ['forced refresh', { metrics: { averageScore: 1 }, lastUpdated: new Date() }],
  ])('GET service does not write on %s', async (_label, cached) => {
    StudentMetrics.findOne.mockReturnValue(responseQuery(cached));
    FormResponse.find.mockReturnValue(responseQuery([]));

    await getStudentMetrics('student-1', { forceRefresh: _label === 'forced refresh' });

    expect(FormResponse.find).toHaveBeenCalled();
    expect(StudentMetrics.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('POST refresh path calculates and upserts metrics', async () => {
    FormResponse.find.mockReturnValue(responseQuery([]));

    await refreshStudentMetrics('student-1');

    expect(StudentMetrics.findOneAndUpdate).toHaveBeenCalledWith(
      { studentId: 'student-1' },
      expect.objectContaining({ studentId: 'student-1', metrics: expect.any(Object) }),
      { upsert: true, new: true },
    );
  });

  test('scheduled refresh uses the persistent computation path', async () => {
    FormResponse.find.mockReturnValue(responseQuery([]));

    await computeStudentMetrics('student-1');

    expect(StudentMetrics.findOneAndUpdate).toHaveBeenCalled();
  });
});
