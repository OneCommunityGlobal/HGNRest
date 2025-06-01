const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Job = require('../models/jobs');
const {
  getJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob,
  getCategories,
} = require('./jobsController');

let mongoServer;

// Mock request and response objects
const mockRequest = (query = {}, params = {}, body = {}) => ({
  query,
  params,
  body,
});

const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

// Setup and teardown
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Job.deleteMany({});
});

describe('Jobs Controller', () => {
  describe('getJobs', () => {
    it('should return paginated jobs with default parameters', async () => {
      // Create test jobs
      const testJobs = Array.from({ length: 20 }, (_, i) => ({
        title: `Job ${i + 1}`,
        category: 'Engineering',
        description: `Description ${i + 1}`,
        imageUrl: `http://example.com/image${i + 1}.jpg`,
        location: 'Remote',
        applyLink: `http://example.com/apply${i + 1}`,
        jobDetailsLink: `http://example.com/details${i + 1}`,
      }));
      await Job.insertMany(testJobs);

      const req = mockRequest();
      const res = mockResponse();

      await getJobs(req, res);

      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          jobs: expect.any(Array),
          pagination: expect.objectContaining({
            totalJobs: 20,
            totalPages: expect.any(Number),
            currentPage: 1,
            limit: 18,
          }),
        })
      );
    });

    it('should filter jobs by search term', async () => {
      await Job.create({
        title: 'Senior Developer',
        category: 'Engineering',
        description: 'Looking for a senior developer',
        imageUrl: 'http://example.com/image.jpg',
        location: 'Remote',
        applyLink: 'http://example.com/apply',
        jobDetailsLink: 'http://example.com/details',
      });

      const req = mockRequest({ search: 'Senior' });
      const res = mockResponse();

      await getJobs(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          jobs: expect.arrayContaining([
            expect.objectContaining({
              title: 'Senior Developer',
            }),
          ]),
        })
      );
    });

    it('should filter jobs by category', async () => {
      await Job.create({
        title: 'Marketing Manager',
        category: 'Marketing',
        description: 'Looking for a marketing manager',
        imageUrl: 'http://example.com/image.jpg',
        location: 'Remote',
        applyLink: 'http://example.com/apply',
        jobDetailsLink: 'http://example.com/details',
      });

      const req = mockRequest({ category: 'Marketing' });
      const res = mockResponse();

      await getJobs(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          jobs: expect.arrayContaining([
            expect.objectContaining({
              category: 'Marketing',
            }),
          ]),
        })
      );
    });
  });

  describe('getJobById', () => {
    it('should return a job by id', async () => {
      const job = await Job.create({
        title: 'Test Job',
        category: 'Engineering',
        description: 'Test Description',
        imageUrl: 'http://example.com/image.jpg',
        location: 'Remote',
        applyLink: 'http://example.com/apply',
        jobDetailsLink: 'http://example.com/details',
      });

      const req = mockRequest({}, { id: job._id });
      const res = mockResponse();

      await getJobById(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Job',
        })
      );
    });

    it('should return 404 for non-existent job', async () => {
      const req = mockRequest({}, { id: new mongoose.Types.ObjectId() });
      const res = mockResponse();

      await getJobById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Job not found',
        })
      );
    });
  });

  describe('createJob', () => {
    it('should create a new job', async () => {
      const jobData = {
        title: 'New Job',
        category: 'Engineering',
        description: 'New Description',
        imageUrl: 'http://example.com/image.jpg',
        location: 'Remote',
        applyLink: 'http://example.com/apply',
        jobDetailsLink: 'http://example.com/details',
      };

      const req = mockRequest({}, {}, jobData);
      const res = mockResponse();

      await createJob(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New Job',
        })
      );
    });

    it('should handle missing required fields', async () => {
      const jobData = {
        title: 'Incomplete Job',
        // Missing required fields
      };

      const req = mockRequest({}, {}, jobData);
      const res = mockResponse();

      await createJob(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Failed to create job',
        })
      );
    });
  });

  describe('updateJob', () => {
    it('should update an existing job', async () => {
      const job = await Job.create({
        title: 'Original Job',
        category: 'Engineering',
        description: 'Original Description',
        imageUrl: 'http://example.com/image.jpg',
        location: 'Remote',
        applyLink: 'http://example.com/apply',
        jobDetailsLink: 'http://example.com/details',
      });

      const updateData = {
        title: 'Updated Job',
      };

      const req = mockRequest({}, { id: job._id }, updateData);
      const res = mockResponse();

      await updateJob(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Updated Job',
        })
      );
    });

    it('should return 404 when updating non-existent job', async () => {
      const req = mockRequest(
        {},
        { id: new mongoose.Types.ObjectId() },
        { title: 'Updated Job' }
      );
      const res = mockResponse();

      await updateJob(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Job not found',
        })
      );
    });
  });

  describe('deleteJob', () => {
    it('should delete a job', async () => {
      const job = await Job.create({
        title: 'Job to Delete',
        category: 'Engineering',
        description: 'Description',
        imageUrl: 'http://example.com/image.jpg',
        location: 'Remote',
        applyLink: 'http://example.com/apply',
        jobDetailsLink: 'http://example.com/details',
      });

      const req = mockRequest({}, { id: job._id });
      const res = mockResponse();

      await deleteJob(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Job deleted successfully',
        })
      );

      const deletedJob = await Job.findById(job._id);
      expect(deletedJob).toBeNull();
    });

    it('should return 404 when deleting non-existent job', async () => {
      const req = mockRequest({}, { id: new mongoose.Types.ObjectId() });
      const res = mockResponse();

      await deleteJob(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Job not found',
        })
      );
    });
  });

  describe('getCategories', () => {
    it('should return all unique categories', async () => {
      await Job.insertMany([
        {
          title: 'Job 1',
          category: 'Engineering',
          description: 'Description 1',
          imageUrl: 'http://example.com/image1.jpg',
          location: 'Remote',
          applyLink: 'http://example.com/apply1',
          jobDetailsLink: 'http://example.com/details1',
        },
        {
          title: 'Job 2',
          category: 'Marketing',
          description: 'Description 2',
          imageUrl: 'http://example.com/image2.jpg',
          location: 'Remote',
          applyLink: 'http://example.com/apply2',
          jobDetailsLink: 'http://example.com/details2',
        },
      ]);

      const req = mockRequest();
      const res = mockResponse();

      await getCategories(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        categories: expect.arrayContaining(['Engineering', 'Marketing']),
      });
    });

    it('should return empty array when no jobs exist', async () => {
      const req = mockRequest();
      const res = mockResponse();

      await getCategories(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        categories: [],
      });
    });
  });
}); 