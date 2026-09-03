const Job = require('../models/jobs');
const JobPositionCategory = require('../models/jobPositionCategory');
const {
  getJobs,
  getJobSummaries,
  getJobTitleSuggestions,
  resetJobsFilters,
  getCategories,
  getPositions,
  getActiveJobPositions,
  getJobById,
  createJob,
  updateJob,
  deleteJob,
  reorderJobs,
} = require('./jobsController');

// 1. Mock the modules
jest.mock('../models/jobs');
jest.mock('../models/jobPositionCategory');

// 2. Explicitly define Mongoose methods as Jest mocks to avoid "not a function" errors
Job.find = jest.fn();
Job.findOne = jest.fn();
Job.findById = jest.fn();
Job.findByIdAndUpdate = jest.fn();
Job.findByIdAndDelete = jest.fn();
Job.countDocuments = jest.fn();
Job.bulkWrite = jest.fn();
Job.distinct = jest.fn();
JobPositionCategory.distinct = jest.fn();

// --- HELPER FACTORIES ---

const mockQueryChain = (resolvedValue) => {
  const chain = {};
  const methods = ['sort', 'skip', 'limit', 'select'];
  methods.forEach((method) => {
    chain[method] = jest.fn().mockReturnValue(chain);
  });
  chain.lean = jest.fn().mockResolvedValue(resolvedValue);
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
        'category as JSON array string',
        { category: '["Software & IT","Marketing"]' },
        { $and: [{ category: { $in: ['Software & IT', 'Marketing'] } }] },
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

    it('should return distinct job titles for the application form dropdown', async () => {
      Job.distinct.mockResolvedValue(['Writer', 'Software Developer', '', 'Analyst']);
      await getActiveJobPositions({}, res);
      expect(Job.distinct).toHaveBeenCalledWith('title', {});
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        positions: ['Analyst', 'Software Developer', 'Writer'],
      });
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

    it('should return a 500 when the database call fails', async () => {
      Job.countDocuments.mockRejectedValue(new Error('db down'));
      await resetJobsFilters({ query: {} }, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Failed to reset filters' }),
      );
    });
  });

  describe('Error handling', () => {
    it('getJobs: returns a 500 when the database call fails', async () => {
      Job.countDocuments.mockRejectedValue(new Error('db down'));
      await getJobs({ query: {} }, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: 'Failed to fetch jobs' }),
      );
    });

    it('getJobSummaries: returns a 500 when the database call fails', async () => {
      Job.find.mockImplementation(() => {
        throw new Error('db down');
      });
      await getJobSummaries({ query: {} }, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: 'Failed to fetch job summaries' }),
      );
    });

    it('getJobById: returns a 500 when the database call fails', async () => {
      Job.findById.mockRejectedValue(new Error('db down'));
      await getJobById({ params: { id: '507f1f77bcf86cd799439011' } }, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Failed to fetch job' }),
      );
    });

    it('updateJob: returns a 500 when the database call fails', async () => {
      Job.findByIdAndUpdate.mockRejectedValue(new Error('db down'));
      await updateJob({ params: { id: '507f1f77bcf86cd799439011' }, body: {} }, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Failed to update job' }),
      );
    });

    it('deleteJob: returns a 500 when the database call fails', async () => {
      Job.findByIdAndDelete.mockRejectedValue(new Error('db down'));
      await deleteJob({ params: { id: '507f1f77bcf86cd799439011' } }, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Failed to delete job' }),
      );
    });
  });

  describe('createJob', () => {
    const newJobBody = {
      title: 'Developer',
      category: 'Software & IT',
      description: 'Build things',
      imageUrl: 'http://example.com/img.png',
      location: 'Remote',
      applyLink: 'http://example.com/apply',
      jobDetailsLink: 'http://example.com/details',
    };

    it('assigns the next displayOrder and saves the job', async () => {
      Job.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue({ displayOrder: 3 }),
      });
      const savedJob = { _id: 'job1', ...newJobBody, displayOrder: 4 };
      jest.spyOn(Job.prototype, 'save').mockResolvedValue(savedJob);

      await createJob({ body: newJobBody }, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(savedJob);
    });

    it('defaults displayOrder to 0 when no jobs exist yet', async () => {
      Job.findOne.mockReturnValue({ sort: jest.fn().mockResolvedValue(null) });
      const savedJob = { _id: 'job1', ...newJobBody, displayOrder: 0 };
      jest.spyOn(Job.prototype, 'save').mockResolvedValue(savedJob);

      await createJob({ body: newJobBody }, res);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('returns a 500 when saving fails', async () => {
      Job.findOne.mockReturnValue({ sort: jest.fn().mockResolvedValue(null) });
      jest.spyOn(Job.prototype, 'save').mockRejectedValue(new Error('db down'));

      await createJob({ body: newJobBody }, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Failed to create job' }),
      );
    });
  });

  describe('reorderJobs', () => {
    it('rejects invalid job order data', async () => {
      await reorderJobs({ body: { jobIds: [] } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid job order data' });
    });

    it('reorders jobs and returns the updated list', async () => {
      Job.bulkWrite.mockResolvedValue({});
      Job.find.mockReturnValue({ sort: jest.fn().mockResolvedValue(DEFAULT_MOCK_JOBS) });

      await reorderJobs({ body: { jobIds: ['1', '2'] } }, res);

      expect(Job.bulkWrite).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, jobs: DEFAULT_MOCK_JOBS }),
      );
    });

    it('returns a 500 when the bulk write fails', async () => {
      Job.bulkWrite.mockRejectedValue(new Error('db down'));

      await reorderJobs({ body: { jobIds: ['1', '2'] } }, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Failed to reorder jobs' }),
      );
    });
  });
});
