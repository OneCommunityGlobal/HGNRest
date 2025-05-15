// First require all dependencies
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const jwt = require('jsonwebtoken');
const moment = require('moment');
const config = require('../config');
require('dotenv').config();

// Then require all services
const dropboxService = require('../services/automation/dropboxService');
const sentryService = require('../services/automation/sentryService');
const githubService = require('../services/automation/githubService');
const slackService = require('../services/automation/slackService');
const googleSheetService = require('../services/automation/googleSheetService');

const { app } = require('../app');

// Set test JWT secret
config.JWT_SECRET = 'test-jwt-secret-key';

// Create test authentication token
const payload = {
  userid: 'test-user-id',
  role: 'admin',
  permissions: ['admin'],
  expiryTimestamp: moment().add(1, 'hour').toDate(),
};
const authToken = jwt.sign(payload, config.JWT_SECRET);

let mongoServer;

const connectDB = async () => {
  try {
    if (!mongoServer) {
      mongoServer = await MongoMemoryServer.create({
        instance: {
          storageEngine: 'wiredTiger'
        },
        binary: {
          version: '4.2.14'
        }
      });
    }
    const mongoUri = await mongoServer.getUri();
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 30000,
    });
  } catch (error) {
    console.error('MongoDB connection error:', error);
    if (mongoServer) {
      await mongoServer.stop();
    }
    throw error;
  }
};

// Update beforeAll
beforeAll(async () => {
  console.log('Setting up MongoDB...');
  await connectDB();
  console.log('MongoDB setup complete');
}, 60000);

// Keep this afterAll (the first one in the file) and remove the duplicate
afterAll(async () => {
  console.log('Cleaning up MongoDB...');
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
  console.log('MongoDB cleanup complete');
}, 60000);


beforeEach(async () => {
  try {
    // Clean up any existing connections
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
    } else {
      await connectDB();
    }
    
    // Clear all collections
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany();
    }
  } catch (error) {
    console.error('Error in beforeEach:', error);
    throw error;
  }
  
  jest.clearAllMocks();

  // Mock Dropbox service
  jest.spyOn(dropboxService, 'createFolderWithSubfolder').mockResolvedValue({
    parentFolderResponse: {
      result: {
        id: 'test-folder-id',
        path_display: '/test-folder',
      },
    },
    subfolderResponse: {
      result: {
        id: 'test-subfolder-id',
        path_display: '/test-folder/Week 1',
      },
    },
  });
  jest.spyOn(dropboxService, 'inviteUserToFolder').mockResolvedValue({ success: true });
  jest.spyOn(dropboxService, 'deleteFolder').mockResolvedValue({ success: true });

  // Mock Sentry service
  jest.spyOn(sentryService, 'inviteUser').mockResolvedValue({ success: true });
  jest
    .spyOn(sentryService, 'getMembers')
    .mockResolvedValue([{ id: 'test-member-id', email: 'test@gmail.com' }]);
  jest.spyOn(sentryService, 'removeUser').mockResolvedValue({ success: true });

  // Mock GitHub service
  jest.spyOn(githubService, 'sendInvitation').mockResolvedValue({ success: true });
  jest.spyOn(githubService, 'removeUser').mockResolvedValue({ success: true });

  // Mock Slack service
  jest.spyOn(slackService, 'sendSlackInvite').mockResolvedValue({ success: true });

  // Mock Google Sheet service
  jest.spyOn(googleSheetService, 'addNewMember').mockResolvedValue({ success: true });
  jest.spyOn(googleSheetService, 'updateMemberStatus').mockResolvedValue({ success: true });
}, 60000);


describe('Automation Controller Tests', () => {
  const testUser = {
    name: 'Test User',
    email: 'test@gmail.com',
    github: 'testuser',
    dropboxFolder: 'test-folder',
  };

  const testUsers = [
    {
      name: 'Test User 1',
      email: 'test1@gmail.com',
      github: 'testuser1',
      dropboxFolder: 'test-folder-1',
    },
    {
      name: 'Test User 2',
      email: 'test2@gmail.com',
      github: 'testuser2',
      dropboxFolder: 'test-folder-2',
    },
  ];

  describe('POST /api/automation/onboard', () => {
    it('should successfully add a new member', async () => {
      const res = await request(app)
        .post('/api/automation/onboard')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testUser);

      if (res.status !== 200) {
        console.error('Error response:', res.body);
      }

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('message', 'Member onboarded successfully');
      expect(res.body.details).toHaveProperty('github');
      expect(res.body.details).toHaveProperty('sentry');
      expect(res.body.details).toHaveProperty('dropbox');
    });

    it('should handle missing required fields', async () => {
      const res = await request(app)
        .post('/api/automation/onboard')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('POST /api/automation/batch-onboard', () => {
    it('should successfully batch add members', async () => {
      const res = await request(app)
        .post('/api/automation/batch-onboard')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ members: testUsers });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('message', 'Batch onboarding completed');
      expect(Array.isArray(res.body.results)).toBe(true);
      expect(res.body.results.length).toBe(testUsers.length);
    });

    it('should handle empty member list', async () => {
      const res = await request(app)
        .post('/api/automation/batch-onboard')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ members: [] });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.results).toHaveLength(0);
    });
  });

  describe('POST /api/automation/offboard', () => {
    it('should successfully remove a member', async () => {
      // First add a member
      await request(app)
        .post('/api/automation/onboard')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testUser);

      // Then remove the member
      const res = await request(app)
        .post('/api/automation/offboard')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: testUser.email,
          github: testUser.github,
          dropboxFolder: testUser.dropboxFolder,
        });

      if (res.status !== 200) {
        console.error('Error response:', res.body);
      }

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('message', 'Member offboarded successfully');
      expect(res.body.details).toHaveProperty('github');
      expect(res.body.details).toHaveProperty('sentry');
      expect(res.body.details.sentry).toHaveProperty('success', true);
    });

    it('should handle non-existent member', async () => {
      const res = await request(app)
        .post('/api/automation/offboard')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: 'nonexistent@example.com',
          github: 'nonexistent',
          dropboxFolder: 'nonexistent-folder',
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.details.sentry).toHaveProperty('success', false);
      expect(res.body.details.sentry).toHaveProperty('message', 'Member not found in Sentry');
    });
  });

  describe('POST /api/automation/batch-offboard', () => {
    it('should successfully batch remove members', async () => {
      const res = await request(app)
        .post('/api/automation/batch-offboard')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ members: testUsers });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('message', 'Batch offboarding completed');
      expect(Array.isArray(res.body.results)).toBe(true);
      expect(res.body.results.length).toBe(testUsers.length);
    });

    it('should handle partial failures', async () => {
      // Mock one member to fail
      jest
        .spyOn(githubService, 'removeUser')
        .mockImplementationOnce(() => Promise.reject(new Error('Failed to remove user')))
        .mockResolvedValueOnce({ success: true });

      const mixedUsers = [
        testUsers[0],
        { email: 'invalid@example.com', github: 'invalid', dropboxFolder: 'invalid' },
      ];

      const res = await request(app)
        .post('/api/automation/batch-offboard')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ members: mixedUsers });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.results.some((r) => !r.success)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid request body', async () => {
      const res = await request(app)
        .post('/api/automation/onboard')
        .set('Authorization', `Bearer ${authToken}`)
        .send(null);

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('error');
    });

    it('should handle duplicate member addition', async () => {
      // First addition
      await request(app)
        .post('/api/automation/onboard')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testUser);

      // Mock second addition to fail
      jest
        .spyOn(githubService, 'sendInvitation')
        .mockImplementationOnce(() => Promise.reject(new Error('User already exists')));

      // Try to add the same member again
      const res = await request(app)
        .post('/api/automation/onboard')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testUser);

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('error');
    });
  });
});
