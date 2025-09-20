const mongoose = require('mongoose');
const ApplicationAnalytics = require('../models/applicationAnalytics');
const applicationAnalyticsController = require('../controllers/applicationAnalyticsController');

// Mock request and response objects
const createMockReq = (query = {}, body = {}) => ({
  query,
  body: {
    requestor: {
      requestorId: 'test-user-id',
      role: 'Administrator',
    },
    ...body,
  },
});

const createMockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('Application Analytics Controller', () => {
  let controller;

  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/hgn-test');
    controller = applicationAnalyticsController(ApplicationAnalytics);
  });

  afterAll(async () => {
    // Clean up test data
    await ApplicationAnalytics.deleteMany({});
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    // Clear test data before each test
    await ApplicationAnalytics.deleteMany({});
  });

  describe('createApplicationData', () => {
    it('should create application analytics data successfully', async () => {
      const req = createMockReq(
        {},
        {
          country: 'US',
          numberOfApplicants: 25,
          role: 'Developer',
          timestamp: new Date(),
        },
      );
      const res = createMockRes();

      await controller.createApplicationData(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Application analytics data created successfully',
          data: expect.objectContaining({
            country: 'US',
            numberOfApplicants: 25,
            role: 'Developer',
          }),
        }),
      );
    });

    it('should reject invalid country code', async () => {
      const req = createMockReq(
        {},
        {
          country: 'INVALID',
          numberOfApplicants: 25,
          role: 'Developer',
        },
      );
      const res = createMockRes();

      await controller.createApplicationData(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid country code. Must be a 2-letter ISO country code (e.g., US, CA, GB)',
        }),
      );
    });

    it('should reject negative numberOfApplicants', async () => {
      const req = createMockReq(
        {},
        {
          country: 'US',
          numberOfApplicants: -5,
          role: 'Developer',
        },
      );
      const res = createMockRes();

      await controller.createApplicationData(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'numberOfApplicants must be a non-negative number',
        }),
      );
    });
  });

  describe('getApplications', () => {
    beforeEach(async () => {
      // Create test data
      const testData = [
        {
          country: 'US',
          numberOfApplicants: 25,
          role: 'Developer',
          timestamp: new Date(),
        },
        {
          country: 'CA',
          numberOfApplicants: 15,
          role: 'Designer',
          timestamp: new Date(),
        },
        {
          country: 'US',
          numberOfApplicants: 10,
          role: 'Designer',
          timestamp: new Date(),
        },
      ];

      await ApplicationAnalytics.insertMany(testData);
    });

    it('should fetch applications data for monthly filter', async () => {
      const req = createMockReq({ filter: 'monthly' });
      const res = createMockRes();

      await controller.getApplications(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              country: 'US',
              totalApplicants: 35, // 25 + 10
            }),
            expect.objectContaining({
              country: 'CA',
              totalApplicants: 15,
            }),
          ]),
          period: expect.objectContaining({
            filter: 'monthly',
          }),
          totalCountries: 2,
          totalApplicants: 50,
        }),
      );
    });

    it('should filter by roles', async () => {
      const req = createMockReq({
        filter: 'monthly',
        roles: JSON.stringify(['Developer']),
      });
      const res = createMockRes();

      await controller.getApplications(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              country: 'US',
              totalApplicants: 25, // Only Developer role
            }),
          ]),
          totalCountries: 1,
          totalApplicants: 25,
        }),
      );
    });

    it('should reject invalid filter', async () => {
      const req = createMockReq({ filter: 'invalid' });
      const res = createMockRes();

      await controller.getApplications(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid filter. Must be weekly, monthly, or yearly',
        }),
      );
    });
  });

  describe('getComparison', () => {
    beforeEach(async () => {
      // Create test data for current and previous periods
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());

      const testData = [
        // Current month data
        {
          country: 'US',
          numberOfApplicants: 30,
          role: 'Developer',
          timestamp: now,
        },
        {
          country: 'CA',
          numberOfApplicants: 20,
          role: 'Designer',
          timestamp: now,
        },
        // Previous month data
        {
          country: 'US',
          numberOfApplicants: 25,
          role: 'Developer',
          timestamp: lastMonth,
        },
        {
          country: 'CA',
          numberOfApplicants: 15,
          role: 'Designer',
          timestamp: lastMonth,
        },
      ];

      await ApplicationAnalytics.insertMany(testData);
    });

    it('should calculate percentage changes correctly', async () => {
      const req = createMockReq({ filter: 'monthly' });
      const res = createMockRes();

      await controller.getComparison(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              country: 'US',
              currentApplicants: 30,
              previousApplicants: 25,
              change: 5,
              percentageChange: 20, // (30-25)/25 * 100
              trend: 'up',
            }),
            expect.objectContaining({
              country: 'CA',
              currentApplicants: 20,
              previousApplicants: 15,
              change: 5,
              percentageChange: 33.33, // (20-15)/15 * 100
              trend: 'up',
            }),
          ]),
          summary: expect.objectContaining({
            totalCountries: 2,
            countriesWithGrowth: 2,
            countriesWithDecline: 0,
            countriesStable: 0,
          }),
        }),
      );
    });
  });
});

module.exports = {
  createMockReq,
  createMockRes,
};
