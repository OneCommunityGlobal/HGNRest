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
});
