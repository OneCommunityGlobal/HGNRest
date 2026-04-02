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

// Mock the Job model
jest.mock('../models/jobs');

beforeEach(() => {
  jest.clearAllMocks();
});

const mockJobQueryChain = (mockJobs) => ({
  sort: jest.fn().mockReturnValue({
    skip: jest.fn().mockReturnValue({
      limit: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockJobs),
      }),
    }),
  }),
});

describe('jobsController', () => {
  describe('getJobs', () => {
    it('should return jobs with pagination when no query parameters are provided', async () => {
      const mockJobs = [
        {
          _id: '1',
          title: 'Experienced MERN Stack Full-stack / Frontend Software Developers',
          category: 'Software & IT',
          description: 'Test job',
        },
        {
          _id: '2',
          title: 'Civil Engineer',
          category: 'Engineering & Technical Design',
          description: 'Test job 2',
        },
      ];

      JobPositionCategory.distinct = jest
        .fn()
        .mockImplementationOnce(() => Promise.resolve([])) // categories
        .mockImplementationOnce(() => Promise.resolve([])); // positions

      Job.countDocuments = jest.fn().mockResolvedValue(2);
      Job.find = jest.fn().mockReturnValue(mockJobQueryChain(mockJobs));

      const req = { query: {} };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };

      await getJobs(req, res);

      expect(Job.countDocuments).toHaveBeenCalledWith({});
      expect(Job.find).toHaveBeenCalledWith({});
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        jobs: mockJobs,
        pagination: {
          totalJobs: 2,
          totalPages: 1,
          currentPage: 1,
          limit: 18,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      });
    });

    it('should return filtered jobs when search and category parameters are provided', async () => {
      const mockJobs = [
        {
          _id: '1',
          title: 'Experienced MERN Stack Full-stack / Frontend Software Developers',
          category: 'Software & IT',
          description: 'Test job',
        },
      ];

      JobPositionCategory.distinct = jest
        .fn()
        .mockImplementationOnce(() => Promise.resolve([]))
        .mockImplementationOnce(() => Promise.resolve([]));
      Job.countDocuments = jest.fn().mockResolvedValue(1);
      Job.find = jest.fn().mockReturnValue(mockJobQueryChain(mockJobs));

      const req = {
        query: {
          search: 'Full-stack',
          category: 'Software & IT',
          page: '1',
          limit: '10',
        },
      };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await getJobs(req, res);

      expect(Job.countDocuments).toHaveBeenCalledWith({
        $and: [
          expect.objectContaining({
            $or: [
              { title: { $regex: 'Full-stack', $options: 'i' } },
              { description: { $regex: 'Full-stack', $options: 'i' } },
            ],
          }),
          { category: { $in: ['Software & IT'] } },
        ],
      });

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        jobs: mockJobs,
        pagination: {
          totalJobs: 1,
          totalPages: 1,
          currentPage: 1,
          limit: 10,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      });
    });

    it('should return filtered jobs when search category and position parameters are provided', async () => {
      const mockJobs = [
        {
          _id: '1',
          title: 'Experienced MERN Stack Full-stack / Frontend Software Developers',
          category: 'Software & IT',
          description: 'Test job',
        },
      ];

      JobPositionCategory.distinct = jest
        .fn()
        .mockImplementationOnce(() => Promise.resolve([]))
        .mockImplementationOnce(() => Promise.resolve([]));
      Job.countDocuments = jest.fn().mockResolvedValue(1);
      Job.find = jest.fn().mockReturnValue(mockJobQueryChain(mockJobs));

      const req = {
        query: {
          search: 'Full-stack',
          category: 'Software & IT',
          position: 'Experienced MERN Stack Full-stack / Frontend Software Developers',
          page: '1',
          limit: '10',
        },
      };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await getJobs(req, res);

      expect(Job.countDocuments).toHaveBeenCalledWith({
        $and: [
          expect.objectContaining({
            $or: [
              { title: { $regex: 'Full-stack', $options: 'i' } },
              { description: { $regex: 'Full-stack', $options: 'i' } },
            ],
          }),
          {
            title: {
              $regex: '^Experienced MERN Stack Full-stack / Frontend Software Developers',
              $options: 'i',
            },
          },
          { category: { $in: ['Software & IT'] } },
        ],
      });

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        jobs: mockJobs,
        pagination: {
          totalJobs: 1,
          totalPages: 1,
          currentPage: 1,
          limit: 10,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      });
    });

    it('should return filtered jobs when search parameter is provided', async () => {
      const mockJobs = [
        {
          _id: '1',
          title: 'Experienced MERN Stack Full-stack / Frontend Software Developers',
          category: 'Software & IT',
          description: 'Test job',
        },
      ];

      JobPositionCategory.distinct = jest
        .fn()
        .mockImplementationOnce(() => Promise.resolve([]))
        .mockImplementationOnce(() => Promise.resolve([]));
      Job.countDocuments = jest.fn().mockResolvedValue(1);
      Job.find = jest.fn().mockReturnValue(mockJobQueryChain(mockJobs));

      const req = { query: { search: 'Full-stack', page: '1', limit: '10' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await getJobs(req, res);

      expect(Job.countDocuments).toHaveBeenCalledWith({
        $and: [
          expect.objectContaining({
            $or: [
              { title: { $regex: 'Full-stack', $options: 'i' } },
              { description: { $regex: 'Full-stack', $options: 'i' } },
            ],
          }),
        ],
      });

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        jobs: mockJobs,
        pagination: {
          totalJobs: 1,
          totalPages: 1,
          currentPage: 1,
          limit: 10,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      });
    });

    it('should return filtered jobs when category parameter is provided', async () => {
      const mockJobs = [
        {
          _id: '1',
          title: 'Experienced MERN Stack Full-stack / Frontend Software Developers',
          category: 'Software & IT',
          description: 'Test job',
        },
      ];

      JobPositionCategory.distinct = jest
        .fn()
        .mockImplementationOnce(() => Promise.resolve([]))
        .mockImplementationOnce(() => Promise.resolve([]));
      Job.countDocuments = jest.fn().mockResolvedValue(1);
      Job.find = jest.fn().mockReturnValue(mockJobQueryChain(mockJobs));

      const req = { query: { category: 'Software & IT', page: '1', limit: '10' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await getJobs(req, res);

      expect(Job.countDocuments).toHaveBeenCalledWith({
        $and: [{ category: { $in: ['Software & IT'] } }],
      });

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        jobs: mockJobs,
        pagination: {
          totalJobs: 1,
          totalPages: 1,
          currentPage: 1,
          limit: 10,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      });
    });

    it('should return filtered jobs when position parameter is provided', async () => {
      const mockJobs = [
        {
          _id: '1',
          title: 'Experienced MERN Stack Full-stack / Frontend Software Developers',
          category: 'Software & IT',
          description: 'Test job',
        },
      ];

      JobPositionCategory.distinct = jest
        .fn()
        .mockImplementationOnce(() => Promise.resolve([]))
        .mockImplementationOnce(() => Promise.resolve([]));
      Job.countDocuments = jest.fn().mockResolvedValue(1);
      Job.find = jest.fn().mockReturnValue(mockJobQueryChain(mockJobs));

      const req = {
        query: {
          position: 'Experienced MERN Stack Full-stack / Frontend Software Developers',
          page: '1',
          limit: '10',
        },
      };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await getJobs(req, res);

      expect(Job.countDocuments).toHaveBeenCalledWith({
        $and: [
          {
            title: {
              $regex: '^Experienced MERN Stack Full-stack / Frontend Software Developers',
              $options: 'i',
            },
          },
        ],
      });

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        jobs: mockJobs,
        pagination: {
          totalJobs: 1,
          totalPages: 1,
          currentPage: 1,
          limit: 10,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      });
    });
  });

  describe('getJobSummaries', () => {
    const mockSummaryJobChain = (mockJobs) => ({
      select: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockJobs),
        }),
      }),
    });

    beforeEach(() => {
      JobPositionCategory.distinct = jest.fn().mockResolvedValue([]);
    });

    it('should return job summaries with sorting', async () => {
      const mockJobs = [{ _id: '1', title: 'Job 1' }];

      Job.countDocuments = jest.fn().mockResolvedValue(1);
      Job.find = jest.fn().mockReturnValue(mockSummaryJobChain(mockJobs));

      const req = { query: {} };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await getJobSummaries(req, res);

      expect(Job.find).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        jobs: mockJobs,
        totalJobs: 1,
      });
    });

    it('should return job summaries when no query parameters are provided', async () => {
      const mockJobs = [{ _id: '1', title: 'Job 1' }];

      Job.countDocuments = jest.fn().mockResolvedValue(1);
      Job.find = jest.fn().mockReturnValue(mockSummaryJobChain(mockJobs));

      const req = { query: {} };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await getJobSummaries(req, res);

      expect(Job.find).toHaveBeenCalled();

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        jobs: mockJobs,
        totalJobs: 1,
      });
    });

    it('should return filtered job summaries when search and category are provided', async () => {
      const mockJobs = [{ _id: '1', title: 'Job 1' }];

      Job.countDocuments = jest.fn().mockResolvedValue(1);
      Job.find = jest.fn().mockReturnValue(mockSummaryJobChain(mockJobs));

      const req = {
        query: {
          search: 'Full-stack',
          category: 'Software & IT',
        },
      };

      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await getJobSummaries(req, res);

      expect(Job.find).toHaveBeenCalled();

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        jobs: mockJobs,
        totalJobs: 1,
      });
    });

    it('should return filtered job summaries when search, category and position are provided', async () => {
      const mockJobs = [{ _id: '1', title: 'Job 1' }];

      Job.countDocuments = jest.fn().mockResolvedValue(1);
      Job.find = jest.fn().mockReturnValue(mockSummaryJobChain(mockJobs));

      const req = {
        query: {
          search: 'Full-stack',
          category: 'Software & IT',
          position: 'Experienced MERN Stack Full-stack / Frontend Software Developers',
        },
      };

      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await getJobSummaries(req, res);

      expect(Job.find).toHaveBeenCalled();

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        jobs: mockJobs,
        totalJobs: 1,
      });
    });

    it('should return filtered job summaries when search is provided', async () => {
      const mockJobs = [{ _id: '1', title: 'Job 1' }];

      Job.countDocuments = jest.fn().mockResolvedValue(1);
      Job.find = jest.fn().mockReturnValue(mockSummaryJobChain(mockJobs));

      const req = { query: { search: 'Full-stack' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await getJobSummaries(req, res);

      expect(Job.find).toHaveBeenCalled();

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        jobs: mockJobs,
        totalJobs: 1,
      });
    });

    it('should return filtered job summaries when category is provided', async () => {
      const mockJobs = [{ _id: '1', title: 'Job 1' }];

      Job.countDocuments = jest.fn().mockResolvedValue(1);
      Job.find = jest.fn().mockReturnValue(mockSummaryJobChain(mockJobs));

      const req = { query: { category: 'Software & IT' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await getJobSummaries(req, res);

      expect(Job.find).toHaveBeenCalled();

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        jobs: mockJobs,
        totalJobs: 1,
      });
    });

    it('should return filtered job summaries when position is provided', async () => {
      const mockJobs = [{ _id: '1', title: 'Job 1' }];

      Job.countDocuments = jest.fn().mockResolvedValue(1);
      Job.find = jest.fn().mockReturnValue(mockSummaryJobChain(mockJobs));

      const req = {
        query: {
          position: 'Experienced MERN Stack Full-stack / Frontend Software Developers',
        },
      };

      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await getJobSummaries(req, res);

      expect(Job.find).toHaveBeenCalled();

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        jobs: mockJobs,
        totalJobs: 1,
      });
    });
  });

  describe('getJobTitleSuggestions', () => {
    it('should return job title suggestions based on query', async () => {
      const mockSuggestions = ['Software Engineer', 'Senior Software Engineer'];

      Job.find = jest.fn().mockReturnValue({
        distinct: jest.fn().mockResolvedValue(mockSuggestions),
      });

      const req = { query: { query: 'Software' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await getJobTitleSuggestions(req, res);

      expect(Job.find).toHaveBeenCalledWith({
        title: { $regex: 'Software', $options: 'i' },
      });
      expect(res.json).toHaveBeenCalledWith({
        suggestions: mockSuggestions,
      });
    });
  });

  describe('getCategories', () => {
    it('should return sorted categories', async () => {
      const mockCategories = [
        'Administrative & Support',
        'Architecture, Landscape & Environment',
        'Creative & Media',
        'Engineering & Technical Design',
        'Skilled Trades & Craft',
        'Software & IT',
      ];

      JobPositionCategory.distinct = jest.fn().mockResolvedValue(mockCategories);

      const req = {};
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await getCategories(req, res);

      expect(JobPositionCategory.distinct).toHaveBeenCalledWith('category', {});
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        categories: mockCategories,
      });
    });
  });

  describe('getPositions', () => {
    it('should return sorted Positions', async () => {
      const mockPositions = [
        'Administrative Assistant',
        'Botanist/Horticulturist',
        'Civil Engineer',
        'Civil or Mechanical Engineer',
        'Electrical Designer/Engineer',
        'Electrical Designer/MEP',
        'Experienced Final Cut Pro Videographer/Video Editor',
        'Experienced MERN Stack Full-stack / Frontend Software Developers',
        'Fundraising-outreach Help',
        'Landscape Architect',
        'Master Carpenter',
        'Mechanical Engineer',
        'MEP/Plumbing Engineer and Designer',
        'Photoshop/Graphic Designer',
        'Structural Engineer',
      ];

      JobPositionCategory.distinct = jest.fn().mockResolvedValue(mockPositions);

      const req = {};
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await getPositions(req, res);

      expect(JobPositionCategory.distinct).toHaveBeenCalledWith('position', {});
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        positions: mockPositions,
      });
    });
  });

  describe('getJobById', () => {
    it('should return a job when valid ID is provided', async () => {
      const mockJob = {
        _id: '507f1f77bcf86cd799439011',
        title: 'Software Engineer',
        category: 'Engineering',
        description: 'Test job description',
      };

      Job.findById = jest.fn().mockResolvedValue(mockJob);

      const req = { params: { id: '507f1f77bcf86cd799439011' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await getJobById(req, res);

      expect(Job.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(res.json).toHaveBeenCalledWith(mockJob);
    });

    it('should return 404 when job is not found', async () => {
      Job.findById = jest.fn().mockResolvedValue(null);

      const req = { params: { id: '507f1f77bcf86cd799439011' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await getJobById(req, res);

      expect(Job.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Job not found' });
    });
  });

  describe('updateJob', () => {
    it('should update a job successfully', async () => {
      const updateData = { title: 'Updated Software Engineer', description: 'Updated description' };
      const mockUpdatedJob = { _id: '507f1f77bcf86cd799439011', ...updateData };

      Job.findByIdAndUpdate = jest.fn().mockResolvedValue(mockUpdatedJob);

      const req = { params: { id: '507f1f77bcf86cd799439011' }, body: updateData };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await updateJob(req, res);

      expect(Job.findByIdAndUpdate).toHaveBeenCalledWith('507f1f77bcf86cd799439011', updateData, {
        new: true,
      });
      expect(res.json).toHaveBeenCalledWith(mockUpdatedJob);
    });
  });

  describe('deleteJob', () => {
    it('should delete a job successfully', async () => {
      const mockDeletedJob = { _id: '507f1f77bcf86cd799439011', title: 'Software Engineer' };

      Job.findByIdAndDelete = jest.fn().mockResolvedValue(mockDeletedJob);

      const req = { params: { id: '507f1f77bcf86cd799439011' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await deleteJob(req, res);

      expect(Job.findByIdAndDelete).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(res.json).toHaveBeenCalledWith({ message: 'Job deleted successfully' });
    });
  });

  describe('resetJobsFilters', () => {
    it('should return all jobs with default sorting and pagination', async () => {
      const mockJobs = [
        { _id: '1', title: 'Software Engineer', category: 'Engineering' },
        { _id: '2', title: 'Product Manager', category: 'Management' },
      ];

      Job.countDocuments = jest.fn().mockResolvedValue(2);
      Job.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue(mockJobs),
          }),
        }),
      });

      const req = { query: { page: '1', limit: '10' } };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };

      await resetJobsFilters(req, res);

      expect(Job.countDocuments).toHaveBeenCalledWith({});
      expect(Job.find).toHaveBeenCalledWith({});
      expect(res.json).toHaveBeenCalledWith({
        jobs: mockJobs,
        pagination: {
          totalJobs: 2,
          totalPages: 1,
          currentPage: 1,
          limit: 10,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      });
    });
  });
});
