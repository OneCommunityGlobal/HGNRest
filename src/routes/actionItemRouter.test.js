const request = require('supertest');
const { jwtPayload } = require('../test');
const { app } = require('../app');
const {
  mockReq,
  createUser,
  mongoHelper: { dbConnect, dbDisconnect, dbClearCollections, dbClearAll },
} = require('../test');

const agent = request.agent(app);

describe('actionItem routes', () => {
  let requestorUser;
  let assignedUser;
  let token;
  const reqBody = {
    ...mockReq.body,
  };

  beforeAll(async () => {
    await dbConnect();
    requestorUser = await createUser(); // requestor user
    assignedUser = await createUser(); // assignedTo user
    token = jwtPayload(requestorUser);
  });

  beforeEach(async () => {
    await dbClearCollections('actionItems');
  });

  afterAll(async () => {
    await dbClearAll();
    await dbDisconnect();
  });

  describe('postactionItem', () => {
    it('should return 401 if authorization header is not present', async () => {
      await agent.post('/api/actionItem').send(reqBody.body).expect(401);
    });

    it('Should return 404 if the route does not exist', async () => {
      await agent
        .post('/api/actionItems')
        .send(reqBody.body)
        .set('Authorization', token)
        .expect(404);
    });

    it('Should create an actionItem on success', async () => {
      const postReqBody = {
        ...reqBody,
        requestor: { requestorId: requestorUser._id, assignedTo: assignedUser._id },
        description: 'Any description',
        assignedTo: assignedUser._id,
      };

      const response = await agent
        .post('/api/actionItem')
        .send(postReqBody)
        .set('Authorization', token)
        .expect(200);

      expect(response.body).toEqual({
        _id: expect.anything(),
        assignedTo: assignedUser._id.toString(),
        createdBy: 'You',
        description: postReqBody.description,
      });
    });
  });
});

// describe('userProfile routes', () => {
//   let user;
//   let token;
//   const reqBody = {
//     // This is the user we want to create
//     body: {
//       ...mockReq.body,
//       ...mockUser(),
//     },
//   };

//   beforeAll(async () => {
//     await dbConnect();
//     await createTestPermissions();
//     user = await createUser(); // This is the requestor user
//     token = jwtPayload(user);
//   });

//   beforeEach(async () => {
//     await dbClearCollections('userProfiles');
//     cache.setCache('allusers', '[]');
//   });

//   afterAll(async () => {
//     await dbClearCollections('rolesMergedPermissions', 'rolePermissionPresets');
//     await dbDisconnect();
//   });

//   describe('postUserProfile', () => {
//     it('should return 401 if authorization header is not present', async () => {
//       await agent.post('/api/userProfile').send(reqBody.body).expect(401);
//     });

//     it("should return 404 if route doesn't exists", async () => {
//       await agent
//         .post('/api/userProfiles')
//         .send(reqBody.body)
//         .set('Authorization', token)
//         .expect(404);
//     });

// test('Should create a userProfile on success', async () => {
//   // adding a user to the database
//   let response = await agent
//     .post('/api/userProfile')
//     .send(reqBody.body)
//     .set('Authorization', token)
//     .expect(200);

//   expect(response.body).toBeTruthy();

//   // user has been saved, if it exists in the database, we should not be able to add another user.
//   response = await agent
//     .post('/api/userProfile')
//     .send(reqBody.body)
//     .set('Authorization', token)
//     .expect(400);

//   expect(response.body.error).toEqual(
//     'That email address is already in use. Please choose another email address.',
//   );
// });
//   });
// });
