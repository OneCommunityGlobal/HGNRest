jest.mock('../models/studentMetrics');
jest.mock('../models/formResponse');
jest.mock('../models/studentGroup');
jest.mock('../models/studentGroupMember');
jest.mock('../models/userProfile');

const StudentMetrics = require('../models/studentMetrics');
const FormResponse = require('../models/formResponse');
const StudentGroup = require('../models/studentGroup');
const StudentGroupMember = require('../models/studentGroupMember');
const UserProfile = require('../models/userProfile');
const {
  parseAnalyticsNumber,
  calculateStudentMetrics,
  refreshStudentMetrics,
  computeStudentMetrics,
  getStudentMetrics,
  getOverview,
} = require('./analyticsService');

const responseQuery = (responses) => ({
  lean: jest.fn().mockResolvedValue(responses),
});

const selectedResponseQuery = (responses) => ({
  select: jest.fn().mockReturnValue(responseQuery(responses)),
});

const overviewResponses = [
  {
    submittedBy: 'student-1',
    submittedAt: new Date('2026-09-02T10:00:00.000Z'),
    responses: [{ questionLabel: 'Score', answer: '80' }],
    timeSpentMinutes: '10',
  },
  {
    submittedBy: 'student-1',
    submittedAt: new Date('2026-09-02T12:00:00.000Z'),
    responses: [{ questionLabel: 'Score', answer: 100 }],
    timeSpentMinutes: 20,
  },
  {
    submittedBy: 'student-2',
    submittedAt: new Date('2026-09-03T08:00:00.000Z'),
    responses: [{ questionLabel: 'Score', answer: 50 }],
    timeSpentMinutes: 'invalid',
  },
];

describe('analyticsService student metrics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    StudentMetrics.findOneAndUpdate.mockResolvedValue({});
    StudentMetrics.aggregate.mockResolvedValue([]);
    FormResponse.find.mockReturnValue(responseQuery([]));
    FormResponse.distinct.mockResolvedValue([]);
    StudentGroup.find.mockReturnValue(selectedResponseQuery([]));
    StudentGroupMember.find.mockReturnValue(selectedResponseQuery([]));
    UserProfile.find.mockReturnValue(selectedResponseQuery([]));
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

  test('keeps unfiltered overview scalar metrics backward compatible', async () => {
    StudentMetrics.aggregate.mockResolvedValue([
      { avgScore: 10.87, avgTime: 0, avgEngagement: 11.333, totalStudents: 15 },
    ]);
    FormResponse.find.mockReturnValue(responseQuery(overviewResponses));
    FormResponse.distinct.mockResolvedValue(['student-1', 'student-2']);
    UserProfile.find.mockReturnValue(
      selectedResponseQuery([
        { _id: 'student-1', firstName: 'Ada', lastName: 'Lovelace' },
        { _id: 'student-2', firstName: 'Grace', lastName: 'Hopper' },
      ]),
    );
    StudentGroup.find.mockReturnValue(selectedResponseQuery([{ _id: 'group-1', name: 'Math' }]));

    await expect(getOverview()).resolves.toEqual(
      expect.objectContaining({
        averageScore: 10.87,
        averageTimeSpentMinutes: 0,
        averageEngagementRate: 11.333,
        totalStudents: 15,
        students: [
          { id: 'student-1', name: 'Ada Lovelace' },
          { id: 'student-2', name: 'Grace Hopper' },
        ],
        classes: [{ id: 'group-1', name: 'Math' }],
      }),
    );
    expect(StudentMetrics.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('applies student and date filters in the FormResponse query', async () => {
    const startDate = new Date('2026-09-02T00:00:00.000Z');
    const endDate = new Date('2026-09-03T23:59:59.999Z');
    FormResponse.find.mockReturnValue(responseQuery(overviewResponses));

    await getOverview({ studentId: 'student-1', startDate, endDate });

    expect(FormResponse.find).toHaveBeenCalledWith({
      submittedBy: 'student-1',
      submittedAt: { $gte: startDate, $lte: endDate },
    });
    expect(StudentMetrics.aggregate).not.toHaveBeenCalled();
    expect(StudentMetrics.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('applies start and end date filters independently in the FormResponse query', async () => {
    const startDate = new Date('2026-09-02T00:00:00.000Z');
    const endDate = new Date('2026-09-03T23:59:59.999Z');

    await getOverview({ startDate });
    expect(FormResponse.find).toHaveBeenLastCalledWith({ submittedAt: { $gte: startDate } });

    await getOverview({ endDate });
    expect(FormResponse.find).toHaveBeenLastCalledWith({ submittedAt: { $lte: endDate } });
  });

  test('uses an inclusive end-date boundary and accepts same-day ranges', async () => {
    const startDate = new Date('2026-09-02T00:00:00.000Z');
    const endDate = new Date('2026-09-02T23:59:59.999Z');

    await getOverview({ startDate, endDate });

    expect(FormResponse.find).toHaveBeenCalledWith({
      submittedAt: { $gte: startDate, $lte: endDate },
    });
  });

  test('filters by class membership and applies a student filter within that class', async () => {
    StudentGroupMember.find.mockReturnValue(
      selectedResponseQuery([{ student_id: 'student-1' }, { student_id: 'student-2' }]),
    );

    await getOverview({ classId: 'group-1', studentId: 'student-1' });

    expect(StudentGroupMember.find).toHaveBeenCalledWith({ group_id: 'group-1' });
    expect(FormResponse.find).toHaveBeenCalledWith({ submittedBy: { $in: ['student-1'] } });
  });

  test('returns an empty result instead of global analytics for an empty class', async () => {
    const result = await getOverview({ classId: 'empty-group' });

    expect(FormResponse.find).toHaveBeenCalledWith({ submittedBy: { $in: [] } });
    expect(result).toEqual(
      expect.objectContaining({
        averageScore: null,
        averageTimeSpentMinutes: null,
        averageEngagementRate: null,
        totalStudents: 0,
        timeSeriesData: [],
      }),
    );
    expect(StudentMetrics.aggregate).not.toHaveBeenCalled();
  });

  test('builds chronologically ordered daily time series using existing metric semantics', async () => {
    const startDate = new Date('2026-09-01T00:00:00.000Z');
    FormResponse.find.mockReturnValue(responseQuery(overviewResponses));

    const result = await getOverview({ startDate });

    expect(result).toEqual(
      expect.objectContaining({
        averageScore: 70,
        averageTimeSpentMinutes: 15,
        averageEngagementRate: 0.15,
        totalStudents: 2,
        timeSeriesData: [
          { date: '2026-09-02', averageScore: 90, timeSpent: 30, engagementRate: 0.2 },
          { date: '2026-09-03', averageScore: 50, timeSpent: 0, engagementRate: 0.1 },
        ],
      }),
    );
  });
});
