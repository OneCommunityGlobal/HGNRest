const request = require('supertest');
const { jwtPayload } = require('../test');
const { app } = require('../app');
const {
  mockReq,
  createUser,
  mongoHelper: { dbConnect, dbDisconnect, dbClearAll },
} = require('../test');

const agent = request.agent(app);

describe('actionItem routes', () => {
  let ownerUser;
  let volunteerUser;
  let ownerToken;
  let volunteerToken;
  let reqBody = {
    ...mockReq.body,
  };

  beforeAll(async () => {
    await dbConnect();
    ownerUser = await createUser();
    volunteerUser = await createUser();
    volunteerUser.role = 'Volunteer';
    ownerToken = jwtPayload(ownerUser);
    volunteerToken = jwtPayload(volunteerUser);
    reqBody = {
      ...reqBody,
    };
  });

  afterAll(async () => {
    await dbClearAll();
    await dbDisconnect();
  });

  describe('mapLocationRoutes', () => {
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

  describe('getMapLocation routes', () => {
    it('Should return 200 and the users on success', async () => {
      const expected = {
        mUsers: [],
        users: [
          {
            location: {
              city: '',
              coords: {
                lat: 51,
                lng: 110,
              },
              country: '',
              userProvided: '',
            },
            isActive: ownerUser.isActive,
            jobTitle: ownerUser.jobTitle[0],
            _id: ownerUser._id.toString(),
            firstName: ownerUser.firstName,
            lastName: ownerUser.lastName,
          },
          {
            location: {
              city: '',
              coords: {
                lat: 51,
                lng: 110,
              },
              country: '',
              userProvided: '',
            },
            isActive: volunteerUser.isActive,
            jobTitle: volunteerUser.jobTitle[0],
            _id: volunteerUser._id.toString(),
            firstName: volunteerUser.firstName,
            lastName: volunteerUser.lastName,
          },
        ],
      };

      const response = await agent
        .get('/api/mapLocations')
        .set('Authorization', ownerToken)
        .send(reqBody)
        .expect(200);

      expect(response.body).toEqual(expected);
    });
  });
});
