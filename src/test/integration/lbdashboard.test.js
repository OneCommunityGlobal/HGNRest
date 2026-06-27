jest.mock('../../models/lbdashboard/LBuser', () => {
  const mockLBUser = jest.fn().mockImplementation(() => ({
    _id: 'mock-user-id-123',
    save: jest.fn().mockResolvedValue(undefined),
  }));
  mockLBUser.findOne = jest.fn();
  return mockLBUser;
});

const request = require('supertest');
const { app } = require('../../app');
const LBUser = require('../../models/lbdashboard/LBuser');

describe('POST /api/lbdashboard/register', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should register a user successfully', async () => {
    LBUser.findOne.mockResolvedValue(null);
    LBUser.mockImplementation(() => ({
      _id: 'mock-user-id-123',
      save: jest.fn().mockResolvedValue(undefined),
    }));

    const res = await request(app).post('/api/lbdashboard/register').send({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phone: '+1234567890',
      password: 'Passw0rd!',
    });

    expect(res.statusCode).toBe(201);
    expect(res.body.message).toBe('Registration successful');
    expect(res.body.userId).toBeDefined();
  });

  it('should reject invalid email and password', async () => {
    const res = await request(app).post('/api/lbdashboard/register').send({
      firstName: 'Jo',
      lastName: 'Doe',
      email: 'invalid-email',
      phone: '+12345678',
      password: '123',
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.errors.email).toBe('Invalid email format');
    expect(res.body.errors.password).toMatch(/Password must/);
  });

  it('should not allow duplicate email', async () => {
    LBUser.findOne.mockResolvedValue({ email: 'jane@example.com' });

    const res = await request(app).post('/api/lbdashboard/register').send({
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@example.com',
      phone: '+19876543211',
      password: 'Secure1!',
    });

    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('Email already registered');
  });
});
