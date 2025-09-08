const request = require('supertest');
const { app } = require('../../app');

const agent = request.agent(app);

describe('rolePreset routes', () => {
  let reqBody;

  // Global timeout for the entire test suite
  jest.setTimeout(60000); // 1 minute

  beforeAll(async () => {
    console.log('=== Starting rolePreset Integration Test Setup ===');

    // Create test data without database operations
    reqBody = {
      roleName: 'some roleName',
      presetName: 'some Preset',
      permissions: ['test', 'write'],
    };

    console.log('✓ Test data prepared');
    console.log('=== rolePreset Integration Test Setup Complete ===');
  }, 60000); // 1 minute timeout for beforeAll

  describe('Authorization Tests', () => {
    it('should return 401 if authorization header is not present', async () => {
      console.log('Testing 401 unauthorized access...');

      try {
        const responses = await Promise.all([
          agent.post('/api/rolePreset').send(reqBody).expect(401),
          agent.get('/api/rolePreset/randomRoleName').send(reqBody).expect(401),
          agent.put(`/api/rolePreset/randomId`).send(reqBody).expect(401),
          agent.delete('/api/rolePreser/randomId').send(reqBody).expect(401),
        ]);

        console.log('✓ All 401 tests passed');
      } catch (error) {
        console.error('❌ 401 tests failed:', error.message);
        throw error;
      }
    }, 30000);
  });
});
