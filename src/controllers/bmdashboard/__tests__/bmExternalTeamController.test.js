const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const ExternalTeam = require('../../../models/bmdashboard/buildingExternalTeam');
const { createExternalTeam } = require('../bmExternalTeamController');

let mongoServer;

// Mock request and response objects
const mockRequest = (body) => ({
  body,
});

const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

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
  test('should create a new external team member successfully', async () => {
    const req = mockRequest({
      firstName: 'John',
      lastName: 'Doe',
      role: 'Contractor',
      team: 'Construction',
      email: 'john@example.com',
      phone: '1234567890'
    });
    const res = mockResponse();

    await createExternalTeam(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({
        firstName: 'John',
        lastName: 'Doe',
        role: 'Contractor',
        team: 'Construction',
        email: 'john@example.com',
        phone: '1234567890'
      })
    });
  });

  test('should handle missing required fields', async () => {
    const req = mockRequest({
      firstName: 'John',
      lastName: 'Doe'
      // Missing required fields: role, team, email
    });
    const res = mockResponse();

    await createExternalTeam(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Missing required fields: role, team, email'
    });
  });

  test('should handle duplicate email addresses', async () => {
    // First create a team member
    const existingMember = new ExternalTeam({
      firstName: 'Jane',
      lastName: 'Doe',
      role: 'Contractor',
      team: 'Construction',
      email: 'jane@example.com',
      phone: '9876543210'
    });
    await existingMember.save();

    // Try to create another member with same email
    const req = mockRequest({
      firstName: 'John',
      lastName: 'Doe',
      role: 'Contractor',
      team: 'Construction',
      email: 'jane@example.com',
      phone: '1234567890'
    });
    const res = mockResponse();

    await createExternalTeam(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Failed to create external team member'
    });
  });

  test('should handle invalid email format', async () => {
    const req = mockRequest({
      firstName: 'John',
      lastName: 'Doe',
      role: 'Contractor',
      team: 'Construction',
      email: 'invalid-email',
      phone: '1234567890'
    });
    const res = mockResponse();

    await createExternalTeam(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Invalid email format'
    });
  });

  test('should handle empty request body', async () => {
    const req = mockRequest({});
    const res = mockResponse();

    await createExternalTeam(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Missing required fields: firstName, lastName, role, team, email'
    });
  });

  test('should handle special characters in name and role', async () => {
    const req = mockRequest({
      firstName: 'John-Doe',
      lastName: 'O\'Connor',
      role: 'Senior Contractor & Consultant',
      team: 'Construction',
      email: 'john@example.com',
      phone: '1234567890'
    });
    const res = mockResponse();

    await createExternalTeam(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({
        firstName: 'John-Doe',
        lastName: 'O\'Connor',
        role: 'Senior Contractor & Consultant',
        team: 'Construction',
        email: 'john@example.com',
        phone: '1234567890'
      })
    });
  });
});
