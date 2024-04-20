const request = require('supertest');
const { jwtPayload } = require('../test');
const { app } = require('../app');
const {
  mockReq,
  createUser,
  mongoHelper: { dbConnect, dbDisconnect, dbClearCollections, dbClearAll },
  createActionItem,
} = require('../test');

const agent = request.agent(app);

describe('actionItem routes', () => {
  let requestorUser;
  let assignedUser;
  let token;
  let reqBody = {
    ...mockReq.body,
  };

  beforeAll(async () => {
    await dbConnect();
    requestorUser = await createUser(); // requestor user
    assignedUser = await createUser(); // assignedTo user
    token = jwtPayload(requestorUser);
    reqBody = {
      ...reqBody,
      requestor: { requestorId: requestorUser._id, assignedTo: assignedUser._id },
      description: 'Any description',
      assignedTo: assignedUser._id,
    };
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
      await agent.post('/api/actionItem').send(reqBody).expect(401);
    });

    it('Should return 404 if the route does not exist', async () => {
      await agent.post('/api/actionItems').send(reqBody).set('Authorization', token).expect(404);
    });

    it('Should create an actionItem on success', async () => {
      const response = await agent
        .post('/api/actionItem')
        .send(reqBody)
        .set('Authorization', token)
        .expect(200);

      expect(response.body).toEqual({
        _id: expect.anything(),
        assignedTo: assignedUser._id.toString(),
        createdBy: 'You',
        description: reqBody.description,
      });
    });
  });

  describe('getActionItem', () => {
    it('should return 401 if authorization header is not present', async () => {
      await agent.get(`/api/actionItem/user/${assignedUser._id}`).expect(401);
    });

    it('Should return 404 if the route does not exist', async () => {
      await agent
        .get(`/api/actionItems/user/${assignedUser._id}`)
        .set('Authorization', token)
        .expect(404);
    });

    it('Should return all actionItems that are assigned to the user on success', async () => {
      // in the case that there are no actionItems, we expect a response of []
      let response = await agent
        .get(`/api/actionItem/user/${assignedUser._id}`)
        .set('Authorization', token)
        .expect(200);

      expect(response.body).toEqual([]);

      /* 
              now we add actionItems for assignedUser
              we use a helper function to create the actionItem instead of 
              the post route to make the route tests independent from each other.
            */
      const newActionItem = await createActionItem(assignedUser._id, requestorUser._id);

      response = await agent
        .get(`/api/actionItem/user/${assignedUser._id}`)
        .set('Authorization', token)
        .expect(200);

      expect(response.body).toEqual([
        {
          _id: newActionItem._id.toString(),
          assignedTo: newActionItem.assignedTo.toString(),
          createdBy: `${requestorUser.firstName} ${requestorUser.lastName}`,
          description: newActionItem.description,
        },
      ]);
    });
  });

  describe('deleteActionItem', () => {
    it('should return 401 if authorization header is not present', async () => {
      await agent.delete(`/api/actionItem/randomid123`).expect(401);
    });

    it('Should return 404 if the route does not exist', async () => {
      await agent
        .delete('/api/actionItems/randomid123')
        .send(reqBody)
        .set('Authorization', token)
        .expect(404);
    });

    it('Should return 400 if no valid records are found', async () => {
      const response = await agent
        .delete('/api/actionItem/623a1c1536fcff1c3414c2d1')
        .send(reqBody)
        .set('Authorization', token)
        .expect(400);

      expect(response.body).toEqual({ message: 'No valid records found' });
    });

    it('Should return 200 and a message of removed on success', async () => {
      // first we need to create a new actionItem
      const actionItem = await createActionItem(assignedUser._id, requestorUser._id);

      const response = await agent
        .delete(`/api/actionItem/${actionItem._id}`)
        .send(reqBody)
        .set('Authorization', token)
        .expect(200);

      expect(response.body).toEqual({ message: 'removed' });
    });
  });

  describe('putActionItem', () => {
    it('Should return 401 if authorization header is not present', async () => {
      await agent.put(`/api/actionItem/randomid123`).expect(401);
    });

    it('Should return 404 if the route does not exist', async () => {
      await agent
        .put('/api/actionItems/randomid123')
        .send(reqBody)
        .set('Authorization', token)
        .expect(404);
    });
    it('Should return 400 if no valid records are found', async () => {
      const response = await agent
        .put('/api/actionItem/623a1c1536fcff1c3414c2d1')
        .send(reqBody)
        .set('Authorization', token)
        .expect(400);

      expect(response.body).toEqual({ message: 'No valid records found' });
    });
    it('Should return 200 on success', async () => {
      // first we need to create a new actionItem
      const actionItem = await createActionItem(assignedUser._id, requestorUser._id);

      const response = await agent
        .put(`/api/actionItem/${actionItem._id}`)
        .send(reqBody)
        .set('Authorization', token)
        .expect(200);
      console.log(response.body);
      expect(response.body).toEqual({ message: 'Saved' });
    });
  });
});
