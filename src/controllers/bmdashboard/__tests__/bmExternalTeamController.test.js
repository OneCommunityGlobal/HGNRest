const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { createExternalTeam } = require('../bmExternalTeamController');
const ExternalTeam = require('../../../models/bmdashboard/buildingExternalTeam');

let mongoServer;

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
  await ExternalTeam.deleteMany({});
});

describe('createExternalTeam', () => {
  it('should create a new external team member successfully', async () => {
    const mockReq = {
      body: {
        firstName: 'John',
        lastName: 'Doe',
        role: 'Contractor',
        team: 'Construction',
        email: 'john.doe@example.com',
        phone: '1234567890'
      }
    };

    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    await createExternalTeam(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(201);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({
        firstName: 'John',
        lastName: 'Doe',
        role: 'Contractor',
        team: 'Construction',
        email: 'john.doe@example.com',
        phone: '1234567890'
      })
    });
  });

  it('should handle missing required fields', async () => {
    const mockReq = {
      body: {
        firstName: 'John',
        lastName: 'Doe'
        // Missing required fields: role, team, email
      }
    };

    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    await createExternalTeam(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      message: 'Failed to create external team member'
    });
  });

  it('should handle duplicate email addresses', async () => {
    // First create a team member
    const existingMember = new ExternalTeam({
      firstName: 'Jane',
      lastName: 'Smith',
      role: 'Architect',
      team: 'Design',
      email: 'jane.smith@example.com'
    });
    await existingMember.save();

    // Try to create another member with the same email
    const mockReq = {
      body: {
        firstName: 'John',
        lastName: 'Doe',
        role: 'Contractor',
        team: 'Construction',
        email: 'jane.smith@example.com' // Duplicate email
      }
    };

    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    await createExternalTeam(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      message: 'Failed to create external team member'
    });
  });
});
