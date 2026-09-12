/**
 * Integration Tests for Paid Labor Cost Routes
 *
 * This test suite covers:
 * 1. Authorization tests (401 responses without auth token)
 * 2. Route functionality tests (method validation, route existence)
 *
 * Note: These tests require the full app to be loaded, which may require
 * additional dependencies (e.g., @aws-sdk/client-s3) to be installed.
 */

const request = require('supertest');
const { app } = require('../../app');

const agent = request.agent(app);

describe('bmPaidLaborCostRoutes tests', () => {
  // Global timeout for the entire test suite
  jest.setTimeout(60000); // 1 minute

  beforeAll(async () => {
    console.log('=== Starting Paid Labor Cost Integration Test Setup ===');
    console.log('✓ Test setup completed');
    console.log('=== Paid Labor Cost Integration Test Setup Complete ===');
  }, 60000); // 1 minute timeout for beforeAll

  /**
   * Authorization Tests
   * Verifies that routes require authentication (return 401 without auth header)
   */
  describe('Authorization Tests', () => {
    it('should return 401 if authorization header is not present for GET /api/labor-cost', async () => {
      console.log('Testing 401 unauthorized access for GET /api/labor-cost...');

      try {
        await agent.get('/api/labor-cost').expect(401);
        console.log('✓ GET /api/labor-cost 401 test passed');
      } catch (error) {
        console.error('❌ GET /api/labor-cost 401 test failed:', error.message);
        throw error;
      }
    }, 30000);

    it('should return 401 if authorization header is not present for GET with query params', async () => {
      console.log('Testing 401 unauthorized access for GET /api/labor-cost with query params...');

      try {
        await agent.get('/api/labor-cost?projects=["A"]').expect(401);
        console.log('✓ GET /api/labor-cost with query params 401 test passed');
      } catch (error) {
        console.error('❌ GET /api/labor-cost with query params 401 test failed:', error.message);
        throw error;
      }
    }, 30000);
  });

  /**
   * Route Functionality Tests
   * Verifies route configuration and method handling
   * Note: Full functionality tests require database connection.
   * If database is not available, these become smoke tests.
   */
  describe('Route Functionality Tests', () => {
    it('should return 404 or method not allowed for POST method', async () => {
      console.log('Testing POST method (should not be allowed)...');

      try {
        const response = await agent.post('/api/labor-cost').send({});
        // POST should return 404 (route doesn't exist), 405 (method not allowed), or 401 (auth required)
        const { status } = response;
        expect([404, 405, 401]).toContain(status);
        console.log(`✓ POST /api/labor-cost returned ${status} as expected`);
      } catch (error) {
        // If it throws, check the status code
        const status = error.status || error.response?.status;
        if ([404, 405, 401].includes(status)) {
          console.log(`✓ POST /api/labor-cost returned ${status} as expected`);
        } else {
          console.error(
            `❌ POST /api/labor-cost test failed with status ${status}:`,
            error.message,
          );
          throw error;
        }
      }
    }, 30000);

    // Note: The following test requires authentication token
    // It will fail with 401 if no token is provided, which is expected
    // To fully test route existence, a valid token would be needed
    it('should have route configured (returns 401 without auth, not 404)', async () => {
      console.log('Testing route existence...');

      try {
        const response = await agent.get('/api/labor-cost');
        // Route exists if we get 401 (unauthorized) rather than 404 (not found)
        expect(response.status).toBe(401);
        console.log('✓ Route exists (returned 401, not 404)');
      } catch (error) {
        // If error status is 401, that's good - route exists
        if (error.status === 401 || error.response?.status === 401) {
          console.log('✓ Route exists (returned 401, not 404)');
        } else if (error.status === 404 || error.response?.status === 404) {
          console.error('❌ Route does not exist (returned 404)');
          throw new Error('Route /api/labor-cost not found');
        } else {
          console.error('❌ Route test failed:', error.message);
          throw error;
        }
      }
    }, 30000);
  });
});
