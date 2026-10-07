const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Job = require('./jobs');

describe('Job model pre-validate jobDetailsLink', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri(), {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  afterEach(async () => {
    await Job.deleteMany({});
    delete process.env.BASE_FRONTEND_URL;
  });

  const baseJob = {
    title: 'Developer',
    category: 'Engineering',
    description: 'desc',
    requirements: 'requirements text',
    projects: 'project-a',
    ourCommunity: 'community text',
    imageUrl: 'https://example.com/img?raw=1',
    location: 'remote',
    applyLink: 'https://example.com/jobforms/507f1f77bcf86cd799439011',
  };

  it('auto-populates jobDetailsLink from BASE_FRONTEND_URL when missing', async () => {
    process.env.BASE_FRONTEND_URL = 'https://app.example.com';
    const job = new Job(baseJob);
    await job.validate();
    expect(job.jobDetailsLink).toBe(`https://app.example.com/jobDetailsLink/${job._id}`);
  });

  it('falls back to localhost when BASE_FRONTEND_URL is unset', async () => {
    const job = new Job(baseJob);
    await job.validate();
    expect(job.jobDetailsLink).toBe(`http://localhost:5173/jobDetailsLink/${job._id}`);
  });

  it('keeps an explicitly provided jobDetailsLink', async () => {
    const job = new Job({
      ...baseJob,
      jobDetailsLink: 'https://custom.example.com/details/1',
    });
    await job.validate();
    expect(job.jobDetailsLink).toBe('https://custom.example.com/details/1');
  });
});
