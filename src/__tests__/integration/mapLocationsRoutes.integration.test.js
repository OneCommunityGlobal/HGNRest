const request = require('supertest');
const { jwtPayload } = require('../../test');
const { app } = require('../../app');
const {
  mockReq,
  createUser,
  createRole,
  mongoHelper: { dbConnect, dbDisconnect, dbClearCollections, dbClearAll },
} = require('../../test');
const MapLocation = require('../../models/mapLocation');

const agent = request.agent(app);

describe('mapLocations routes', () => {
  let adminUser;
  let adminToken;
  let volunteerUser;
  let volunteerToken;
  let reqBody = {
    ...mockReq.body,
  };

  beforeAll(async () => {
    // Increase timeout for MongoDB connection in CI
    jest.setTimeout(60000); // 60 seconds

    try {
      console.log('Connecting to MongoDB...');
      await dbConnect();
      console.log('MongoDB connected successfully');

      adminUser = await createUser();
      volunteerUser = await createUser();
      volunteerUser.role = 'Volunteer';
      adminToken = jwtPayload(adminUser);
      volunteerToken = jwtPayload(volunteerUser);
      await createRole('Administrator', ['putUserLocation']);
      await createRole('Volunteer', []);
      console.log('Test setup completed');
    } catch (error) {
      console.error('Error in beforeAll:', error);
      throw error;
    }
  }, 60000); // 60 second timeout for beforeAll

  afterAll(async () => {
    await dbClearAll();
    await dbDisconnect();
  });
  it('should return 401 if authorization header is not present', async () => {
    await agent.get('/api/mapLocations').send(reqBody).expect(401);
    await agent.put('/api/mapLocations').send(reqBody).expect(401);
    await agent.patch('/api/mapLocations').send(reqBody).expect(401);
    await agent.delete('/api/mapLocations/123').send(reqBody).expect(401);
  });
  it('should return 404 if the route does not exist', async () => {
    await agent
      .get('/api/mapLocation')
      .set('Authorization', volunteerToken)
      .send(reqBody)
      .expect(404);
    await agent
      .put('/api/mapLocation')
      .set('Authorization', volunteerToken)
      .send(reqBody)
      .expect(404);
    await agent
      .patch('/api/mapLocation')
      .set('Authorization', volunteerToken)
      .send(reqBody)
      .expect(404);
    await agent
      .delete('/api/mapLocation/123')
      .set('Authorization', volunteerToken)
      .send(reqBody)
      .expect(404);
  });
});
