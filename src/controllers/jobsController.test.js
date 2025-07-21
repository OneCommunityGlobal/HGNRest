const Job = require('../models/jobs');
const {
  getJobs,
  getJobSummaries,
  getJobTitleSuggestions,
  resetJobsFilters,
  getCategories,
  getJobById,
  updateJob,
  deleteJob,
} = require('./jobsController');

// Mock the Job model
jest.mock('../models/jobs');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('jobsController', () => {
  describe('getJobs', () => {
    it('should return jobs with pagination when no query parameters are provided', async () => {
      // Arrange
      const mockJobs = [
        { _id: '1', title: 'Software Engineer', category: 'Engineering', description: 'Test job' },
        { _id: '2', title: 'Product Manager', category: 'Management', description: 'Test job 2' }
      ];
      
      Job.countDocuments = jest.fn().mockResolvedValue(2);
      Job.find = jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue(mockJobs)
        })
      });

      const req = {
        query: {}
      };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      };

      // Act
      await getJobs(req, res);

      // Assert
      expect(Job.countDocuments).toHaveBeenCalledWith({});
      expect(Job.find).toHaveBeenCalledWith({});
      expect(res.json).toHaveBeenCalledWith({
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
      // Arrange
      const mockJobs = [
        { _id: '1', title: 'Software Engineer', category: 'Engineering', description: 'Test job' }
      ];
      
      Job.countDocuments = jest.fn().mockResolvedValue(1);
      Job.find = jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue(mockJobs)
        })
      });

      const req = {
        query: {
          search: 'Software',
          category: 'Engineering',
          page: '1',
          limit: '10'
        }
      };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      };

      // Act
      await getJobs(req, res);

      // Assert
      expect(Job.countDocuments).toHaveBeenCalledWith({
        $or: [
          { title: { $regex: expect.any(RegExp) } },
          { description: { $regex: expect.any(RegExp) } }
        ],
        category: 'Engineering'
      });
      expect(res.json).toHaveBeenCalledWith({
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
    it('should return job summaries with sorting and pagination', async () => {
      // Arrange
      const mockJobs = [
        { _id: '1', title: 'Software Engineer', category: 'Engineering', location: 'Remote' }
      ];
      
      Job.countDocuments = jest.fn().mockResolvedValue(1);
      Job.find = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue(mockJobs)
            })
          })
        })
      });

      const req = {
        query: {
          page: '1',
          limit: '5'
        }
      };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      };

      // Act
      await getJobSummaries(req, res);

      // Assert
      expect(Job.countDocuments).toHaveBeenCalledWith({});
      expect(Job.find).toHaveBeenCalledWith({});
      expect(res.json).toHaveBeenCalledWith({
        jobs: mockJobs,
        pagination: {
          totalJobs: 1,
          totalPages: 1,
          currentPage: 1,
          limit: 5,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      });
    });
  });

  describe('getJobTitleSuggestions', () => {
    it('should return job title suggestions based on query', async () => {
      // Arrange
      const mockSuggestions = ['Software Engineer', 'Senior Software Engineer'];
      
      Job.find = jest.fn().mockReturnValue({
        distinct: jest.fn().mockResolvedValue(mockSuggestions)
      });

      const req = {
        query: {
          query: 'Software'
        }
      };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      };

      // Act
      await getJobTitleSuggestions(req, res);

      // Assert
      expect(Job.find).toHaveBeenCalledWith({
        title: { $regex: 'Software', $options: 'i' }
      });
      expect(res.json).toHaveBeenCalledWith({
        suggestions: mockSuggestions
      });
    });
  });

  describe('getCategories', () => {
    it('should return sorted categories', async () => {
      // Arrange
      const mockCategories = ['Engineering', 'Marketing', 'Sales'];
      
      Job.distinct = jest.fn().mockResolvedValue(mockCategories);

      const req = {};
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      };

      // Act
      await getCategories(req, res);

      // Assert
      expect(Job.distinct).toHaveBeenCalledWith('category', {});
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        categories: mockCategories
      });
    });
  });

  describe('getJobById', () => {
    it('should return a job when valid ID is provided', async () => {
      // Arrange
      const mockJob = {
        _id: '507f1f77bcf86cd799439011',
        title: 'Software Engineer',
        category: 'Engineering',
        description: 'Test job description'
      };
      
      Job.findById = jest.fn().mockResolvedValue(mockJob);

      const req = {
        params: {
          id: '507f1f77bcf86cd799439011'
        }
      };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      };

      // Act
      await getJobById(req, res);

      // Assert
      expect(Job.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(res.json).toHaveBeenCalledWith(mockJob);
    });

    it('should return 404 when job is not found', async () => {
      // Arrange
      Job.findById = jest.fn().mockResolvedValue(null);

      const req = {
        params: {
          id: '507f1f77bcf86cd799439011'
        }
      };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      };

      // Act
      await getJobById(req, res);

      // Assert
      expect(Job.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Job not found' });
    });
  });

  describe('updateJob', () => {
    it('should update a job successfully', async () => {
      // Arrange
      const updateData = {
        title: 'Updated Software Engineer',
        description: 'Updated description'
      };

      const mockUpdatedJob = {
        _id: '507f1f77bcf86cd799439011',
        ...updateData
      };

      Job.findByIdAndUpdate = jest.fn().mockResolvedValue(mockUpdatedJob);

      const req = {
        params: {
          id: '507f1f77bcf86cd799439011'
        },
        body: updateData
      };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      };

      // Act
      await updateJob(req, res);

      // Assert
      expect(Job.findByIdAndUpdate).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        updateData,
        { new: true }
      );
      expect(res.json).toHaveBeenCalledWith(mockUpdatedJob);
    });
  });

  describe('deleteJob', () => {
    it('should delete a job successfully', async () => {
      // Arrange
      const mockDeletedJob = {
        _id: '507f1f77bcf86cd799439011',
        title: 'Software Engineer'
      };

      Job.findByIdAndDelete = jest.fn().mockResolvedValue(mockDeletedJob);

      const req = {
        params: {
          id: '507f1f77bcf86cd799439011'
        }
      };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      };

      // Act
      await deleteJob(req, res);

      // Assert
      expect(Job.findByIdAndDelete).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(res.json).toHaveBeenCalledWith({ message: 'Job deleted successfully' });
    });
  });

  describe('resetJobsFilters', () => {
    it('should return all jobs with default sorting and pagination', async () => {
      // Arrange
      const mockJobs = [
        { _id: '1', title: 'Software Engineer', category: 'Engineering' },
        { _id: '2', title: 'Product Manager', category: 'Management' }
      ];
      
      Job.countDocuments = jest.fn().mockResolvedValue(2);
      Job.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue(mockJobs)
          })
        })
      });

      const req = {
        query: {
          page: '1',
          limit: '10'
        }
      };
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      };

      // Act
      await resetJobsFilters(req, res);

      // Assert
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
