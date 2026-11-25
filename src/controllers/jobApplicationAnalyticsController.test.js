jest.mock('../models/jobApplicationsModel');
jest.mock('../models/JobFormsModel', () => {
  const mock = jest.fn();
  mock.collection = { name: 'jobforms' };
  mock.countDocuments = jest.fn();
  return mock;
});
jest.mock('../utilities/jobFormPermissions', () => ({
  canManageJobForms: jest.fn(),
}));

const Response = require('../models/jobApplicationsModel');
const Form = require('../models/JobFormsModel');
const { canManageJobForms } = require('../utilities/jobFormPermissions');
const {
  listJobApplications,
  getJobApplicationsSummary,
  getJobApplicationById,
  createJobApplication,
  updateJobApplication,
  deleteJobApplication,
  _test: {
    fillWeekdayCounts,
    fillHourCounts,
    bucketHours,
    bucketCommitment,
    normalizeBucketRows,
    formatAnswerValue,
    buildFormattedAnswers,
    isProtectedAnswer,
    normalizeIncomingAnswers,
    mergeAnswers,
  },
} = require('./jobApplicationAnalyticsController');

const createMockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('jobApplicationAnalyticsController', () => {
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    res = createMockRes();
    canManageJobForms.mockResolvedValue(true);
  });

  describe('listJobApplications', () => {
    it('returns 403 when the requestor cannot manage job forms', async () => {
      canManageJobForms.mockResolvedValue(false);
      await listJobApplications({ query: {}, body: { requestor: { role: 'Volunteer' } } }, res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(Response.countDocuments).not.toHaveBeenCalled();
    });

    it('returns paginated items with defaults', async () => {
      const items = [
        {
          _id: 'a1',
          formId: '507f1f77bcf86cd799439011',
          formTitle: 'Software',
          respondent: 'Ada',
          email: 'ada@example.com',
          submittedAt: new Date('2026-01-02'),
          resumeUrl: '',
          answerCount: 3,
        },
      ];
      Response.countDocuments = jest.fn().mockResolvedValue(1);
      Response.aggregate = jest.fn().mockResolvedValue(items);

      await listJobApplications({ query: {}, body: { requestor: { role: 'Owner' } } }, res);

      expect(Response.countDocuments).toHaveBeenCalled();
      expect(Response.aggregate).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        total: 1,
        page: 1,
        limit: 25,
        items,
      });
    });

    it('applies search, formId, and page/limit caps', async () => {
      Response.countDocuments = jest.fn().mockResolvedValue(0);
      Response.aggregate = jest.fn().mockResolvedValue([]);

      await listJobApplications(
        {
          query: {
            q: 'ada',
            formId: '507f1f77bcf86cd799439011',
            page: '2',
            limit: '500',
            sort: 'asc',
          },
          body: { requestor: { role: 'Administrator' } },
        },
        res,
      );

      const matchArg = Response.countDocuments.mock.calls[0][0];
      expect(matchArg.formId).toBeDefined();
      expect(matchArg.$or).toHaveLength(2);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2, limit: 100, total: 0, items: [] }),
      );
    });

    it('filters by from/to submittedAt range and ignores invalid dates', async () => {
      Response.countDocuments = jest.fn().mockResolvedValue(0);
      Response.aggregate = jest.fn().mockResolvedValue([]);

      await listJobApplications(
        {
          query: {
            from: '2026-01-01T00:00:00.000Z',
            to: '2026-01-31T23:59:59.000Z',
          },
          body: { requestor: { role: 'Owner' } },
        },
        res,
      );

      const rangeMatch = Response.countDocuments.mock.calls[0][0];
      expect(rangeMatch.submittedAt.$gte).toEqual(new Date('2026-01-01T00:00:00.000Z'));
      expect(rangeMatch.submittedAt.$lte).toEqual(new Date('2026-01-31T23:59:59.000Z'));

      await listJobApplications(
        {
          query: { from: 'not-a-date', to: 'also-bad' },
          user: { role: 'Owner' },
        },
        res,
      );

      const invalidMatch = Response.countDocuments.mock.calls[1][0];
      expect(invalidMatch.submittedAt).toBeUndefined();
    });

    it('supports from-only and to-only filters and falls back to req.user', async () => {
      Response.countDocuments = jest.fn().mockResolvedValue(0);
      Response.aggregate = jest.fn().mockResolvedValue([]);

      await listJobApplications(
        {
          query: { from: '2026-02-01T00:00:00.000Z' },
          user: { role: 'Administrator' },
        },
        res,
      );
      expect(Response.countDocuments.mock.calls[0][0].submittedAt).toEqual({
        $gte: new Date('2026-02-01T00:00:00.000Z'),
      });

      await listJobApplications(
        {
          query: { to: '2026-02-28T00:00:00.000Z', page: '0', limit: 'abc' },
          user: { role: 'Owner' },
        },
        res,
      );
      expect(Response.countDocuments.mock.calls[1][0].submittedAt).toEqual({
        $lte: new Date('2026-02-28T00:00:00.000Z'),
      });
      expect(res.json).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, limit: 25 }));
    });

    it('ignores invalid formId and escapes regex metacharacters in q', async () => {
      Response.countDocuments = jest.fn().mockResolvedValue(0);
      Response.aggregate = jest.fn().mockResolvedValue([]);

      await listJobApplications(
        {
          query: { formId: 'not-an-object-id', q: 'a+b*c?' },
          body: { requestor: { role: 'Owner' } },
        },
        res,
      );

      const matchArg = Response.countDocuments.mock.calls[0][0];
      expect(matchArg.formId).toBeUndefined();
      expect(matchArg.$or[0].email.$regex).toBe('a\\+b\\*c\\?');
    });

    it('returns 500 when listing fails', async () => {
      Response.countDocuments = jest.fn().mockRejectedValue(new Error('db down'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await listJobApplications({ query: {}, body: { requestor: { role: 'Owner' } } }, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ message: 'Error fetching job applications.' });
      consoleSpy.mockRestore();
    });
  });

  describe('getJobApplicationsSummary', () => {
    it('returns 403 without manageJobForms', async () => {
      canManageJobForms.mockResolvedValue(false);
      await getJobApplicationsSummary({ body: { requestor: { role: 'Volunteer' } } }, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('returns summary counts for authorized users', async () => {
      Response.countDocuments = jest
        .fn()
        .mockResolvedValueOnce(40)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(12);
      Response.aggregate = jest
        .fn()
        .mockResolvedValueOnce([{ count: 30 }]) // unique applicants
        .mockResolvedValueOnce([{ formId: 'f1', formTitle: 'Software', count: 10 }]) // top forms
        .mockResolvedValueOnce([{ _id: 2, count: 4 }]) // weekday
        .mockResolvedValueOnce([{ _id: 14, count: 3 }]) // hour
        .mockResolvedValueOnce([{ label: '2026-01-02', count: 2 }]) // trend
        .mockResolvedValueOnce([{ label: '10–19 hrs/week', count: 5 }]) // hours
        .mockResolvedValueOnce([{ label: '3–6 months', count: 4 }]) // commitment
        .mockResolvedValueOnce([{ label: '2026-03-01', count: 2 }]); // joining
      Response.distinct = jest.fn().mockResolvedValue(['f1', 'f2']);
      Form.countDocuments = jest.fn().mockResolvedValue(8);

      await getJobApplicationsSummary({ body: { requestor: { role: 'Owner' } } }, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          totalApplications: 40,
          applicationsLast7Days: 5,
          applicationsLast30Days: 12,
          uniqueApplicants: 30,
          activeForms: 8,
          formsWithSubmissions: 2,
          topForms: [{ formId: 'f1', formTitle: 'Software', count: 10 }],
          hoursPerWeekBreakdown: [{ label: '10–19 hrs/week', count: 5 }],
          commitmentBreakdown: [{ label: '3–6 months', count: 4 }],
          joiningExpectations: [{ label: '2026-03-01', count: 2 }],
        }),
      );
      const payload = res.json.mock.calls[0][0];
      expect(payload.applicationsByWeekday).toHaveLength(7);
      expect(payload.applicationsByHour).toHaveLength(24);
      expect(payload.applicationsByWeekday.find((d) => d.label === 'Mon').count).toBe(4);
    });

    it('defaults uniqueApplicants to 0 when aggregate is empty and uses req.user', async () => {
      Response.countDocuments = jest.fn().mockResolvedValue(0);
      Response.aggregate = jest.fn().mockResolvedValue([]);
      Response.distinct = jest.fn().mockResolvedValue([null, 'f1']);
      Form.countDocuments = jest.fn().mockResolvedValue(1);

      await getJobApplicationsSummary({ user: { role: 'Owner' } }, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          uniqueApplicants: 0,
          formsWithSubmissions: 1,
          hoursPerWeekBreakdown: [],
          commitmentBreakdown: [],
          joiningExpectations: [],
        }),
      );
    });

    it('returns 500 when summary fails', async () => {
      Response.countDocuments = jest.fn().mockRejectedValue(new Error('summary boom'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await getJobApplicationsSummary({ body: { requestor: { role: 'Owner' } } }, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Error fetching job application summary.',
      });
      consoleSpy.mockRestore();
    });
  });

  describe('getJobApplicationById', () => {
    const validId = '507f1f77bcf86cd799439011';
    const questionId = '507f1f77bcf86cd799439012';

    it('returns 403 without manageJobForms', async () => {
      canManageJobForms.mockResolvedValue(false);
      await getJobApplicationById(
        { params: { applicationId: validId }, body: { requestor: { role: 'Volunteer' } } },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('returns 400 for invalid ids', async () => {
      await getJobApplicationById(
        { params: { applicationId: 'bad' }, body: { requestor: { role: 'Owner' } } },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns formatted question answers for authorized users', async () => {
      Response.findById = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: validId,
          formId: '507f1f77bcf86cd799439099',
          respondent: 'Ada',
          email: 'ada@example.com',
          submittedAt: new Date('2026-01-02'),
          resumeUrl: 'https://example.com/resume.pdf',
          answers: [
            { questionId, answer: 'React and Node' },
            {
              questionId: '507f1f77bcf86cd799439013',
              answer: { type: 'applicantProfile', hoursPerWeek: '12' },
            },
          ],
        }),
      });
      Form.findById = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            title: 'Software',
            questions: [{ _id: questionId, questionText: 'Key skills?', questionType: 'textarea' }],
          }),
        }),
      });

      await getJobApplicationById(
        { params: { applicationId: validId }, body: { requestor: { role: 'Owner' } } },
        res,
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          formTitle: 'Software',
          respondent: 'Ada',
          answers: [
            expect.objectContaining({
              questionText: 'Key skills?',
              displayValue: 'React and Node',
            }),
          ],
        }),
      );
    });
  });

  describe('createJobApplication', () => {
    const formId = '507f1f77bcf86cd799439099';
    const questionId = '507f1f77bcf86cd799439012';

    it('returns 403 without manageJobForms', async () => {
      canManageJobForms.mockResolvedValue(false);
      await createJobApplication(
        { body: { requestor: { role: 'Volunteer' }, formId, email: 'a@b.com' } },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('returns 400 when formId or email is missing', async () => {
      await createJobApplication({ body: { requestor: { role: 'Owner' }, email: 'a@b.com' } }, res);
      expect(res.status).toHaveBeenCalledWith(400);

      await createJobApplication({ body: { requestor: { role: 'Owner' }, formId } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('creates an application for authorized users', async () => {
      Form.findById = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ _id: formId, title: 'Software', questions: [] }),
        }),
      });
      const createdDoc = {
        _id: '507f1f77bcf86cd799439011',
        formId,
        respondent: 'Ada',
        email: 'ada@example.com',
        resumeUrl: '',
        submittedAt: new Date('2026-01-02'),
        answers: [{ questionId, answer: 'React' }],
        toObject() {
          return this;
        },
      };
      Response.create = jest.fn().mockResolvedValue(createdDoc);

      await createJobApplication(
        {
          body: {
            requestor: { role: 'Owner' },
            formId,
            respondent: 'Ada',
            email: 'ada@example.com',
            answers: [{ questionId, answer: 'React' }],
          },
        },
        res,
      );

      expect(Response.create).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          respondent: 'Ada',
          email: 'ada@example.com',
        }),
      );
    });
  });

  describe('updateJobApplication', () => {
    const validId = '507f1f77bcf86cd799439011';
    const questionId = '507f1f77bcf86cd799439012';

    it('returns 403 without manageJobForms', async () => {
      canManageJobForms.mockResolvedValue(false);
      await updateJobApplication(
        { params: { applicationId: validId }, body: { requestor: { role: 'Volunteer' } } },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('updates respondent/email/answers and preserves protected answers', async () => {
      const application = {
        _id: validId,
        formId: '507f1f77bcf86cd799439099',
        respondent: 'Old',
        email: 'old@example.com',
        resumeUrl: '',
        submittedAt: new Date('2026-01-02'),
        answers: [
          { questionId, answer: 'Old answer' },
          {
            questionId: '507f1f77bcf86cd799439014',
            answer: { type: 'applicantProfile', hours: 10 },
          },
        ],
        save: jest.fn().mockResolvedValue(undefined),
        toObject() {
          return this;
        },
      };
      Response.findById = jest.fn().mockResolvedValue(application);
      Form.findById = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            title: 'Software',
            questions: [{ _id: questionId, questionText: 'Skills?', questionType: 'text' }],
          }),
        }),
      });

      await updateJobApplication(
        {
          params: { applicationId: validId },
          body: {
            requestor: { role: 'Owner' },
            respondent: 'Ada',
            email: 'ada@example.com',
            answers: [{ questionId, answer: 'Updated' }],
          },
        },
        res,
      );

      expect(application.respondent).toBe('Ada');
      expect(application.email).toBe('ada@example.com');
      expect(application.answers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ answer: 'Updated' }),
          expect.objectContaining({
            answer: expect.objectContaining({ type: 'applicantProfile' }),
          }),
        ]),
      );
      expect(application.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('deleteJobApplication', () => {
    const validId = '507f1f77bcf86cd799439011';

    it('returns 403 without manageJobForms', async () => {
      canManageJobForms.mockResolvedValue(false);
      await deleteJobApplication(
        { params: { applicationId: validId }, body: { requestor: { role: 'Volunteer' } } },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('deletes an application for authorized users', async () => {
      Response.findByIdAndDelete = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: validId }),
      });

      await deleteJobApplication(
        { params: { applicationId: validId }, body: { requestor: { role: 'Owner' } } },
        res,
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ _id: validId, deleted: true });
    });

    it('returns 404 when the application is missing', async () => {
      Response.findByIdAndDelete = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      await deleteJobApplication(
        { params: { applicationId: validId }, body: { requestor: { role: 'Owner' } } },
        res,
      );

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns 400 for invalid ids and 500 on delete failure', async () => {
      await deleteJobApplication(
        { params: { applicationId: 'bad' }, body: { requestor: { role: 'Owner' } } },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(400);

      Response.findByIdAndDelete = jest.fn().mockReturnValue({
        lean: jest.fn().mockRejectedValue(new Error('delete failed')),
      });
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      await deleteJobApplication(
        { params: { applicationId: validId }, body: { requestor: { role: 'Owner' } } },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(500);
      consoleSpy.mockRestore();
    });
  });

  describe('helper coverage', () => {
    it('fills weekday and hour buckets with zeros for missing rows', () => {
      expect(fillWeekdayCounts([{ _id: 1, count: 2 }])[0]).toEqual({ label: 'Sun', count: 2 });
      expect(fillWeekdayCounts()).toHaveLength(7);
      expect(fillHourCounts([{ _id: 9, count: 4 }])[9]).toEqual({ label: '09:00', count: 4 });
      expect(fillHourCounts()).toHaveLength(24);
    });

    it('buckets hours and commitment ranges', () => {
      expect(bucketHours(NaN)).toBeNull();
      expect(bucketHours(0)).toBeNull();
      expect(bucketHours(5)).toBe('< 10 hrs/week');
      expect(bucketHours(15)).toBe('10–19 hrs/week');
      expect(bucketHours(25)).toBe('20–29 hrs/week');
      expect(bucketHours(40)).toBe('30+ hrs/week');

      expect(bucketCommitment(NaN)).toBeNull();
      expect(bucketCommitment(0)).toBeNull();
      expect(bucketCommitment(1)).toBe('< 2 months');
      expect(bucketCommitment(2.5)).toBe('2–3 months');
      expect(bucketCommitment(4)).toBe('3–6 months');
      expect(bucketCommitment(9)).toBe('6+ months');
    });

    it('normalizes bucket rows and formats answer values', () => {
      expect(
        normalizeBucketRows([{ label: 'A', count: 1 }, null, { label: '', count: 2 }]),
      ).toEqual([{ label: 'A', count: 1 }]);
      expect(normalizeBucketRows([{ label: 'B' }, { label: 'A', count: 3 }])[0].label).toBe('A');

      expect(formatAnswerValue(null)).toBe('—');
      expect(formatAnswerValue('')).toBe('—');
      expect(formatAnswerValue(['a', null, 'b'])).toBe('a, b');
      expect(formatAnswerValue([[], null])).toBe('—');
      expect(formatAnswerValue(true)).toBe('Yes');
      expect(formatAnswerValue(false)).toBe('No');
      expect(formatAnswerValue(new Date('2026-03-01T12:00:00.000Z'))).toBe('2026-03-01');
      expect(formatAnswerValue({ type: 'resume', fileName: 'cv.pdf' })).toBe('cv.pdf');
      expect(formatAnswerValue({ type: 'resume', url: 'https://x/r' })).toBe('https://x/r');
      expect(formatAnswerValue({ type: 'resume' })).toBe('Resume uploaded');
      expect(formatAnswerValue({ type: 'applicantProfile' })).toBeNull();
      expect(formatAnswerValue({ fileName: 'shot.png' })).toBe('shot.png');
      expect(formatAnswerValue({ url: 'https://x/f' })).toBe('https://x/f');
      expect(formatAnswerValue({ nested: true })).toBe('{"nested":true}');
      expect(formatAnswerValue(42)).toBe('42');

      const circular = {};
      circular.self = circular;
      expect(formatAnswerValue(circular)).toBe('—');
    });

    it('builds formatted answers and merges protected entries', () => {
      const questionId = '507f1f77bcf86cd799439012';
      const formatted = buildFormattedAnswers(
        {
          answers: [
            { questionId, answer: 'Hello' },
            { questionId: 'x', answer: { type: 'resume', fileName: 'a.pdf' } },
            { questionId: 'y', answer: { type: 'applicantProfile' } },
            { questionId: 'z', answer: ['one', 'two'] },
          ],
        },
        {
          questions: [{ _id: questionId, questionText: 'Intro', questionType: 'text' }],
        },
      );
      expect(formatted).toEqual([
        expect.objectContaining({ questionText: 'Intro', displayValue: 'Hello' }),
        expect.objectContaining({ questionText: 'Question 4', displayValue: 'one, two' }),
      ]);
      expect(buildFormattedAnswers({}, null)).toEqual([]);

      expect(isProtectedAnswer({ type: 'resume' })).toBe(true);
      expect(isProtectedAnswer({ type: 'applicantProfile' })).toBe(true);
      expect(isProtectedAnswer('nope')).toBeFalsy();
      expect(isProtectedAnswer(['x'])).toBeFalsy();

      expect(normalizeIncomingAnswers(null)).toBeNull();
      expect(() => normalizeIncomingAnswers({ bad: true })).toThrow('answers must be an array.');
      const normalized = normalizeIncomingAnswers([
        { questionId, answer: 'ok' },
        { questionId: 'bad', answer: 'skip' },
        null,
      ]);
      expect(normalized).toHaveLength(1);
      expect(String(normalized[0].questionId)).toBe(questionId);

      const merged = mergeAnswers(
        [
          { questionId, answer: 'old' },
          { questionId: 'p', answer: { type: 'resume', fileName: 'cv.pdf' } },
        ],
        [{ questionId, answer: 'new' }],
      );
      expect(merged).toEqual([
        { questionId, answer: 'new' },
        { questionId: 'p', answer: { type: 'resume', fileName: 'cv.pdf' } },
      ]);
      expect(mergeAnswers(null, [{ questionId, answer: 'only' }])).toEqual([
        { questionId, answer: 'only' },
      ]);
    });
  });

  describe('additional CRUD edge cases', () => {
    const validId = '507f1f77bcf86cd799439011';
    const formId = '507f1f77bcf86cd799439099';

    it('getById returns 404 and 500 when needed', async () => {
      Response.findById = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });
      await getJobApplicationById(
        { params: { applicationId: validId }, body: { requestor: { role: 'Owner' } } },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(404);

      Response.findById = jest.fn().mockReturnValue({
        lean: jest.fn().mockRejectedValue(new Error('boom')),
      });
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      await getJobApplicationById(
        { params: { applicationId: validId }, body: { requestor: { role: 'Owner' } } },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(500);
      consoleSpy.mockRestore();
    });

    it('create returns 404 for missing form, 400 for bad answers, and 500 on failure', async () => {
      Form.findById = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      });
      await createJobApplication(
        { body: { requestor: { role: 'Owner' }, formId, email: 'a@b.com' } },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(404);

      Form.findById = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ _id: formId, title: 'Software' }),
        }),
      });
      await createJobApplication(
        {
          body: {
            requestor: { role: 'Owner' },
            formId,
            email: 'a@b.com',
            answers: { not: 'array' },
          },
        },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(400);

      Response.create = jest.fn().mockRejectedValue(new Error('create failed'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      await createJobApplication(
        { body: { requestor: { role: 'Owner' }, formId, email: 'a@b.com', answers: [] } },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(500);
      consoleSpy.mockRestore();
    });

    it('update validates id/email/answers and handles missing docs and failures', async () => {
      await updateJobApplication(
        { params: { applicationId: 'bad' }, body: { requestor: { role: 'Owner' } } },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(400);

      Response.findById = jest.fn().mockResolvedValue(null);
      await updateJobApplication(
        { params: { applicationId: validId }, body: { requestor: { role: 'Owner' } } },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(404);

      const application = {
        _id: validId,
        formId,
        respondent: 'Ada',
        email: 'ada@example.com',
        resumeUrl: '',
        answers: [],
        save: jest.fn().mockResolvedValue(undefined),
        toObject() {
          return this;
        },
      };
      Response.findById = jest.fn().mockResolvedValue(application);
      Form.findById = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ title: 'Software', questions: [] }),
        }),
      });

      await updateJobApplication(
        {
          params: { applicationId: validId },
          body: { requestor: { role: 'Owner' }, email: '   ' },
        },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(400);

      await updateJobApplication(
        {
          params: { applicationId: validId },
          body: {
            requestor: { role: 'Owner' },
            resumeUrl: ' https://x/r ',
            answers: { bad: true },
          },
        },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(400);

      application.save = jest.fn().mockRejectedValue(new Error('save failed'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      await updateJobApplication(
        {
          params: { applicationId: validId },
          body: { requestor: { role: 'Owner' }, respondent: 'New' },
        },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(500);
      consoleSpy.mockRestore();
    });
  });
});
