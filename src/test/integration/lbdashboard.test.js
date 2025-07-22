const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const {app} = require('../../app'); // your Express app
const LBUser = require('../../models/lbdashboard/LBUser');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), { dbName: 'test' });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await LBUser.deleteMany();
});

describe('POST /lbdashboard/register', () => {
  it('should register a user successfully', async () => {
    const res = await request(app)
      .post('/lbdashboard/register')
      .send({
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
    const res = await request(app)
      .post('/lbdashboard/register')
      .send({
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
    await request(app)
      .post('/lbdashboard/register')
      .send({
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        phone: '+19876543210',
        password: 'Secure1!',
      });

    const res = await request(app)
      .post('/lbdashboard/register')
      .send({
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
