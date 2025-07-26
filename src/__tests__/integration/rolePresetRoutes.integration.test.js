const request = require('supertest');
const { jwtPayload } = require('../../test');
const { app } = require('../../app');
const {
  mockReq,
  createUser,
  createRole,
  mongoHelper: { dbConnect, dbDisconnect, dbClearCollections, dbClearAll },
} = require('../../test');

const agent = request.agent(app);

describe('rolePreset routes', () => {
  let adminUser;
  let adminToken;
  let volunteerUser;
  let volunteerToken;
  let reqBody = {
    ...mockReq.body,
  };

  // Global timeout for the entire test suite
  jest.setTimeout(60000); // 1 minute

  beforeAll(async () => {
    console.log('=== Starting rolePreset Integration Test Setup ===');

    try {
      // Step 1: Connect to MongoDB (or create minimal environment)
      console.log('Step 1: Connecting to MongoDB...');
      await dbConnect();
      console.log('✓ MongoDB connected successfully');

      // Step 2: Create test users
      console.log('Step 2: Creating test users...');
      adminUser = await createUser();
      volunteerUser = await createUser();
      volunteerUser.role = 'Volunteer';
      console.log('✓ Test users created');

      // Step 3: Create JWT tokens
      console.log('Step 3: Creating JWT tokens...');
      adminToken = jwtPayload(adminUser);
      volunteerToken = jwtPayload(volunteerUser);
      console.log('✓ JWT tokens created');

      // Step 4: Create roles
      console.log('Step 4: Creating roles...');
      await createRole('Administrator', ['putRole']);
      await createRole('Volunteer', []);
      console.log('✓ Roles created');

      console.log('=== rolePreset Integration Test Setup Complete ===');
    } catch (error) {
      console.error('❌ Setup failed:', error);
      // Continue with test even if setup fails - we'll test the API endpoints
      console.log('Continuing with minimal test setup...');
    }
  }, 60000); // 1 minute timeout for beforeAll

  beforeEach(async () => {
    try {
      console.log('Clearing rolePreset collections...');
      await dbClearCollections('rolePreset');

      reqBody = {
        ...reqBody,
        roleName: 'some roleName',
        presetName: 'some Preset',
        permissions: ['test', 'write'],
      };
      console.log('✓ Test data prepared');
    } catch (error) {
      console.error('❌ beforeEach failed:', error);
      // Continue with test even if cleanup fails
    }
  });

  afterAll(async () => {
    try {
      console.log('=== Cleaning up rolePreset Integration Test ===');
      await dbClearAll();
      await dbDisconnect();
      console.log('✓ Cleanup completed');
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
    }
  });

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

    it('Should return 403 if user does not have permissions', async () => {
      console.log('Testing 403 forbidden access...');

      try {
        const response = await agent
          .post('/api/rolePreset')
          .send(reqBody)
          .set('Authorization', volunteerToken)
          .expect(403);

        expect(response.text).toEqual('You are not authorized to make changes to roles.');
        console.log('✓ 403 test passed');
      } catch (error) {
        console.error('❌ 403 test failed:', error.message);
        throw error;
      }
    }, 30000);
  });

  describe('Validation Tests', () => {
    it('Should return 400 if missing roleName', async () => {
      console.log('Testing 400 missing roleName...');

      try {
        const testBody = { ...reqBody, roleName: null };
        const response = await agent
          .post('/api/rolePreset')
          .send(testBody)
          .set('Authorization', adminToken)
          .expect(400);

        expect(response.body).toEqual({
          error: 'roleName, presetName, and permissions are mandatory fields.',
        });
        console.log('✓ Missing roleName test passed');
      } catch (error) {
        console.error('❌ Missing roleName test failed:', error.message);
        throw error;
      }
    }, 30000);

    it('Should return 400 if missing presetName', async () => {
      console.log('Testing 400 missing presetName...');

      try {
        const testBody = { ...reqBody, presetName: null };
        const response = await agent
          .post('/api/rolePreset')
          .send(testBody)
          .set('Authorization', adminToken)
          .expect(400);

        expect(response.body).toEqual({
          error: 'roleName, presetName, and permissions are mandatory fields.',
        });
        console.log('✓ Missing presetName test passed');
      } catch (error) {
        console.error('❌ Missing presetName test failed:', error.message);
        throw error;
      }
    }, 30000);

    it('Should return 400 if missing permissions', async () => {
      console.log('Testing 400 missing permissions...');

      try {
        const testBody = { ...reqBody, permissions: null };
        const response = await agent
          .post('/api/rolePreset')
          .send(testBody)
          .set('Authorization', adminToken)
          .expect(400);

        expect(response.body).toEqual({
          error: 'roleName, presetName, and permissions are mandatory fields.',
        });
        console.log('✓ Missing permissions test passed');
      } catch (error) {
        console.error('❌ Missing permissions test failed:', error.message);
        throw error;
      }
    }, 30000);
  });
});
