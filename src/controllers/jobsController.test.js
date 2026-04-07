const Job = require('../models/jobs');
const JobPositionCategory = require('../models/jobPositionCategory');
const {
  getJobs,
  getJobSummaries,
  getJobTitleSuggestions,
  resetJobsFilters,
  getCategories,
  getPositions,
  getJobById,
  updateJob,
  deleteJob,
} = require('./jobsController');

// 1. Mock the modules
jest.mock('../models/jobs');
jest.mock('../models/jobPositionCategory');

// 2. Explicitly define Mongoose methods as Jest mocks to avoid "not a function" errors
Job.find = jest.fn();
Job.findById = jest.fn();
Job.findByIdAndUpdate = jest.fn();
Job.findByIdAndDelete = jest.fn();
Job.countDocuments = jest.fn();
JobPositionCategory.distinct = jest.fn();

// --- HELPER FACTORIES ---

const mockQueryChain = (resolvedValue) => {
  const chain = {};
  const methods = ['sort', 'skip', 'limit', 'select', 'lean'];
  methods.forEach((method) => {
    chain[method] = jest.fn().mockReturnValue(chain);
  });
  chain.lean = jest.fn().mockResolvedValue(resolvedValue);
  chain.then = (resolve) => resolve(resolvedValue);
  return chain;
};

const createMockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const DEFAULT_MOCK_JOBS = [
  { _id: '1', title: 'Developer', category: 'Software & IT', description: 'Test' },
];

// --- TESTS ---

describe('jobsController', () => {
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    res = createMockRes();
    JobPositionCategory.distinct.mockResolvedValue([]);
  });

  describe('Filtering Logic (getJobs & getJobSummaries)', () => {
    const filterCases = [
      ['no params', {}, {}],
      ['search only', { search: 'Full-stack' }, { $and: [expect.any(Object)] }],
      [
        'category only',
        { category: 'Software & IT' },
        { $and: [{ category: { $in: ['Software & IT'] } }] },
      ],
      [
        'position only',
        { position: 'Developer' },
        { $and: [{ title: { $regex: '^Developer', $options: 'i' } }] },
      ],
      [
        'all params',
        { search: 'Full-stack', category: 'IT', position: 'Dev' },
        { $and: [expect.any(Object), expect.any(Object), expect.any(Object)] },
      ],
    ];

    test.each(filterCases)(
      'getJobs: should work with %s',
      async (desc, query, expectedCriteria) => {
        Job.countDocuments.mockResolvedValue(1);
        Job.find.mockReturnValue(mockQueryChain(DEFAULT_MOCK_JOBS));

        await getJobs({ query }, res);

        expect(Job.find).toHaveBeenCalledWith(expectedCriteria);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
      },
    );

    test.each(filterCases)(
      'getJobSummaries: should work with %s',
      async (desc, query, expectedCriteria) => {
        Job.countDocuments.mockResolvedValue(1);
        Job.find.mockReturnValue(mockQueryChain(DEFAULT_MOCK_JOBS));

        await getJobSummaries({ query }, res);

        expect(Job.find).toHaveBeenCalledWith(expectedCriteria);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
      },
    );
  });

  describe('Metadata & Suggestions', () => {
    it('should return job title suggestions', async () => {
      Job.find.mockReturnValue({ distinct: jest.fn().mockResolvedValue(['Title']) });
      await getJobTitleSuggestions({ query: { query: 'abc' } }, res);
      expect(res.json).toHaveBeenCalledWith({ suggestions: ['Title'] });
    });

    it('should return categories', async () => {
      JobPositionCategory.distinct.mockResolvedValue(['Cat1']);
      await getCategories({}, res);
      expect(res.json).toHaveBeenCalledWith({ categories: ['Cat1'] });
    });

    it('should return positions', async () => {
      JobPositionCategory.distinct.mockResolvedValue(['Pos1']);
      await getPositions({}, res);
      expect(res.json).toHaveBeenCalledWith({ positions: ['Pos1'] });
    });
  });

  describe('CRUD Operations', () => {
    const jobId = '507f1f77bcf86cd799439011';

    it('getJobById: should handle found and not found', async () => {
      // Test Found
      Job.findById.mockResolvedValueOnce(DEFAULT_MOCK_JOBS[0]);
      await getJobById({ params: { id: jobId } }, res);
      expect(res.json).toHaveBeenCalledWith(DEFAULT_MOCK_JOBS[0]);

      // Test Not Found
      Job.findById.mockResolvedValueOnce(null);
      await getJobById({ params: { id: jobId } }, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('updateJob: should update successfully', async () => {
      const updateData = { title: 'New' };
      Job.findByIdAndUpdate.mockResolvedValue({ _id: jobId, ...updateData });
      await updateJob({ params: { id: jobId }, body: updateData }, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining(updateData));
    });

    it('deleteJob: should delete successfully', async () => {
      Job.findByIdAndDelete.mockResolvedValue({ _id: jobId });
      await deleteJob({ params: { id: jobId } }, res);
      expect(res.json).toHaveBeenCalledWith({ message: 'Job deleted successfully' });
    });
  });

  describe('resetJobsFilters', () => {
    it('should return reset jobs state', async () => {
      Job.countDocuments.mockResolvedValue(1);
      Job.find.mockReturnValue(mockQueryChain(DEFAULT_MOCK_JOBS));
      await resetJobsFilters({ query: { page: '1', limit: '10' } }, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ jobs: DEFAULT_MOCK_JOBS }));
    });
  });
});
