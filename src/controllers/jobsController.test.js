const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Job = require('../models/jobs');
const {
  getJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob,
} = require('./jobsController');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer?.stop) await mongoServer.stop();
});

beforeEach(async () => {
  await Job.deleteMany({});
});

// Helper function to create valid job data
const createValidJobData = (overrides = {}) => ({
  title: 'Software Engineer',
  category: 'Tech',
  description: 'A detailed job description for the position',
  imageUrl: 'https://example.com/image.jpg',
  location: 'New York, NY',
  applyLink: 'https://example.com/apply',
  jobDetailsLink: 'https://example.com/details',
  ...overrides
});

describe('Jobs Controller', () => {
  it('should return an empty array of jobs initially', async () => {
    const req = { query: {} };
    const res = { json: jest.fn() };
    await getJobs(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      jobs: expect.arrayContaining([]),
      pagination: expect.any(Object)
    }));
  });

  it('should create a new job', async () => {
    const jobData = createValidJobData();
    const req = { body: jobData };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await createJob(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Software Engineer',
      category: 'Tech'
    }));
  });

  it('should return a job by ID', async () => {
    const jobData = createValidJobData({ title: 'Manager', category: 'HR' });
    const job = await Job.create(jobData);
    const req = { params: { id: job._id.toString() } };
    const res = { json: jest.fn() };
    await getJobById(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ title: 'Manager' }));
  });

  it('should update a job', async () => {
    const jobData = createValidJobData({ title: 'Developer', category: 'Tech' });
    const job = await Job.create(jobData);
    const req = { params: { id: job._id }, body: { title: 'Senior Developer' } };
    const res = { json: jest.fn() };
    await updateJob(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ title: 'Senior Developer' }));
  });

  it('should delete a job', async () => {
    const jobData = createValidJobData({ title: 'Intern', category: 'Tech' });
    const job = await Job.create(jobData);
    const req = { params: { id: job._id } };
    const res = { json: jest.fn() };
    await deleteJob(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Job deleted successfully' }));
  });
});
