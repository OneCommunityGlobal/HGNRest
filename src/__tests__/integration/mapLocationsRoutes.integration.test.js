const request = require('supertest');
const { jwtPayload } = require('../../test');
const { app } = require('../../app');
const {
  mockReq,
  createUser,
  mongoHelper: { dbConnect, dbDisconnect, dbClearAll },
} = require('../../test');
const MapLocation = require('../../models/mapLocation');

const agent = request.agent(app);

describe('mapLocations routes', () => {
  let ownerUser;
  let volunteerUser;
  let volunteerToken;
  let reqBody = {
    ...mockReq.body,
  };
  beforeAll(async () => {
    await dbConnect();
    ownerUser = await createUser();
    volunteerUser = await createUser();
    ownerUser.role = 'Owner';
    volunteerUser.role = 'Volunteer';
    volunteerToken = jwtPayload(volunteerUser);
    reqBody = {
      ...reqBody,
      firstName: volunteerUser.firstName,
      lastName: volunteerUser.lastName,
      jobTitle: 'Software Engineer',
      location: {
        userProvided: 'A',
        coords: {
          lat: '51',
          lng: '110',
        },
        country: 'Test',
        city: 'Usa',
      },
      _id: volunteerUser._id,
      type: 'user',
    };
  });
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
