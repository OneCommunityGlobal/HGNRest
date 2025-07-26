const request = require('supertest');
const { app } = require('../../app');

const agent = request.agent(app);

describe('PopupEditorBackups tests', () => {
  let reqBody;

  // Global timeout for the entire test suite
  jest.setTimeout(60000); // 1 minute

  beforeAll(async () => {
    console.log('=== Starting PopupEditorBackups Integration Test Setup ===');

    // Create test data without database operations
    reqBody = {
      popupName: 'Test Popup',
      popupContent: 'Test Content',
      isActive: true,
    };

    console.log('✓ Test data prepared');
    console.log('=== PopupEditorBackups Integration Test Setup Complete ===');
  }, 60000); // 1 minute timeout for beforeAll

  describe('Authorization Tests', () => {
    it('should return 401 if authorization header is not present', async () => {
      console.log('Testing 401 unauthorized access...');

      try {
        const responses = await Promise.all([
          agent.post('/api/popupEditorBackup').send(reqBody).expect(401),
          agent.get('/api/popupEditorBackup/randomId').send(reqBody).expect(401),
          agent.put(`/api/popupEditorBackup/randomId`).send(reqBody).expect(401),
          agent.delete('/api/popupEditorBackup/randomId').send(reqBody).expect(401),
        ]);

        console.log('✓ All 401 tests passed');
      } catch (error) {
        console.error('❌ 401 tests failed:', error.message);
        throw error;
      }
    }, 30000);
  });
});
