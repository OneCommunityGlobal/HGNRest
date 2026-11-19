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
        .mockResolvedValueOnce([{ count: 30 }])
        .mockResolvedValueOnce([{ formId: 'f1', formTitle: 'Software', count: 10 }]);
      Response.distinct = jest.fn().mockResolvedValue(['f1', 'f2']);
      Form.countDocuments = jest.fn().mockResolvedValue(8);

      await getJobApplicationsSummary({ body: { requestor: { role: 'Owner' } } }, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        totalApplications: 40,
        applicationsLast7Days: 5,
        applicationsLast30Days: 12,
        uniqueApplicants: 30,
        activeForms: 8,
        formsWithSubmissions: 2,
        topForms: [{ formId: 'f1', formTitle: 'Software', count: 10 }],
      });
    });
  });
});
