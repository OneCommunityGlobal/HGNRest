const request = require('supertest');
const { app } = require('../../app');

const agent = request.agent(app);

describe('mapLocations routes', () => {
  let reqBody;

  // Global timeout for the entire test suite
  jest.setTimeout(60000); // 1 minute

  beforeAll(async () => {
    console.log('=== Starting MapLocations Integration Test Setup ===');

    // Create test data without database operations
    reqBody = {
      firstName: 'Test',
      lastName: 'User',
      jobTitle: 'Software Engineer',
      location: {
        userProvided: 'Test Location',
        coords: {
          lat: '51.5074',
          lng: '-0.1278',
        },
        country: 'Test Country',
        city: 'Test City',
      },
      _id: '507f1f77bcf86cd799439011',
      type: 'user',
    };

    console.log('✓ Test data prepared');
    console.log('=== MapLocations Integration Test Setup Complete ===');
  }, 60000); // 1 minute timeout for beforeAll

  describe('Authorization Tests', () => {
    it('should return 401 if authorization header is not present', async () => {
      console.log('Testing 401 unauthorized access...');

      try {
        const responses = await Promise.all([
          agent.post('/api/mapLocations').send(reqBody).expect(401),
          agent.get('/api/mapLocations/randomId').send(reqBody).expect(401),
          agent.put(`/api/mapLocations/randomId`).send(reqBody).expect(401),
          agent.delete('/api/mapLocations/randomId').send(reqBody).expect(401),
        ]);

        console.log('✓ All 401 tests passed');
      } catch (error) {
        console.error('❌ 401 tests failed:', error.message);
        throw error;
      }
    }, 30000);
  });
});
