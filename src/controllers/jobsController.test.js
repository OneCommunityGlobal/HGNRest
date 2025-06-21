const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const Job = require('../models/jobs'); // Ensure this path is correct
const { app } = require('../app'); // Ensure this path correctly exports your Express app

let mongoServer; // Declared outside to ensure scope for afterAll

beforeAll(async () => {
  try {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri); // Removed deprecated options
  } catch (error) {
    console.error('Error during Jobs Controller setup:', error);
    throw error; // Re-throw to fail early if setup fails
  }
});

afterAll(async () => {
  try {
    await mongoose.disconnect();
    if (mongoServer) { // Ensure mongoServer is defined before stopping
      await mongoServer.stop();
    }
  } catch (error) {
    console.error('Error during Jobs Controller teardown:', error);
    throw error;
  }
});

beforeEach(async () => {
  await Job.deleteMany({});
});

describe('Jobs Controller', () => {
  describe('GET /api/jobs', () => {
    test('should return empty jobs array when no jobs exist', async () => {
      const response = await request(app)
        .get('/api/jobs')
        .expect(200);

      expect(response.body).toEqual({
        jobs: [],
        pagination: {
          totalJobs: 0,
          totalPages: 0,
          currentPage: 1,
          limit: 18,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      });
    });

    test('should return all jobs when jobs exist', async () => {
      const testJob = new Job({
        title: 'Software Engineer',
        category: 'Engineering',
        company: 'Tech Corp',
        location: 'San Francisco',
        description: 'Full-stack development role',
        salary: 120000,
        imageUrl: 'https://example.com/image.jpg',
        applyLink: 'https://example.com/apply',
        jobDetailsLink: 'https://example.com/details',
        // Add datePosted and featured if your Job model expects them and they are used in sorting/filtering
        datePosted: new Date(),
        featured: false,
      });
      await testJob.save();

      const response = await request(app)
        .get('/api/jobs')
        .expect(200);

      expect(response.body.jobs).toHaveLength(1);
      expect(response.body.jobs[0].title).toBe('Software Engineer');
      expect(response.body.pagination.totalJobs).toBe(1);
    });
  });

  describe('GET /api/jobs/:id', () => {
    test('should return job by id when job exists', async () => {
      const testJob = new Job({
        title: 'Data Scientist',
        category: 'Data Science',
        company: 'AI Labs',
        location: 'New York',
        description: 'Machine learning role',
        salary: 150000,
        imageUrl: 'https://example.com/data-scientist.jpg',
        applyLink: 'https://example.com/apply-data',
        jobDetailsLink: 'https://example.com/details-data',
        datePosted: new Date(),
        featured: false,
      });
      const savedJob = await testJob.save();

      const response = await request(app)
        .get(`/api/jobs/${savedJob._id}`)
        .expect(200);

      expect(response.body.title).toBe('Data Scientist');
      expect(response.body.category).toBe('Data Science');
    });

    test('should return 404 when job does not exist', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .get(`/api/jobs/${fakeId}`)
        .expect(404);

      expect(response.body.error).toBe('Job not found');
    });
  });
});