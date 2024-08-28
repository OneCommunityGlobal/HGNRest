const request = require('supertest');
const { jwtPayload } = require('../test');
const { app } = require('../app');
const {
  mockReq,
  createUser,
  createRole,
  mongoHelper: { dbConnect, dbDisconnect, dbClearCollections, dbClearAll },
} = require('../test');
const Information = require('../models/information');

const agent = request.agent(app);

describe('rolePreset routes', () => {
  let adminUser;
  let adminToken;
  let reqBody = {
    ...mockReq.body,
  };
  beforeAll(async () => {
    await dbConnect();
    adminUser = await createUser();
    adminToken = jwtPayload(adminUser);
    // create 2 roles. One with permission and one without
    await createRole('Administrator', []);
  });
  beforeEach(async () => {
    await dbClearCollections('informations');
    reqBody = {
      ...reqBody,
      infoName: 'some infoName',
      infoContent: 'some infoContent',
      visibility: '1',
    };
  });

  afterAll(async () => {
    await dbClearAll();
    await dbDisconnect();
  });
  describe('informationRoutes', () => {
    it('should return 401 if authorization header is not present', async () => {
      await agent.post('/api/informations').send(reqBody).expect(401);
      await agent.get('/api/informations/randomID').send(reqBody).expect(401);
    });
  });
  describe('Post Information route', () => {
    it('Should return 201 if the information is successfully added', async () => {
      const newReqBody = {
        ...reqBody,
        infoName: 'add infoName',
        infoContent: 'add infoContent',
        visibility: '1',
      };
      const response = await agent
        .post('/api/informations')
        .send(newReqBody)
        .set('Authorization', adminToken)
        .expect(201);

      expect(response.body).toEqual({
        _id: expect.anything(),
        __v: expect.anything(),
        infoName: newReqBody.infoName,
        infoContent: newReqBody.infoContent,
        visibility: newReqBody.visibility,
      });
    });
  });
  describe('Get Information route', () => {
    it('Should return 201 if the information is successfully added', async () => {
      const newReqBody = {
        ...reqBody,
        infoName: 'get infoName',
        infoContent: 'get infoContent',
        visibility: '0',
      };
      const _info = new Information();
      _info.infoName = newReqBody.infoName;
      _info.infoContent = newReqBody.infoContent;
      _info.visibility = newReqBody.visibility;
      await _info.save();
      const response = await agent
        .get('/api/informations')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body).toEqual([
        {
          _id: expect.anything(),
          infoName: newReqBody.infoName,
          infoContent: newReqBody.infoContent,
          visibility: newReqBody.visibility,
        },
      ]);
    });
  });
  describe('Delete Information route', () => {
    it('Should return 400 if the route does not exist', async () => {
      await agent
        .delete('/api/informations/random123')
        .send(reqBody)
        .set('Authorization', adminToken)
        .expect(400);
    });
    // it.only('Should return 200 if deleting successfully', async () => {
    //     // const newReqBody = {
    //     //     body:{
    //     //         ...reqBody,
    //     //         infoName: 'delete infoName',
    //     //         infoContent: 'delete infoContent',
    //     //         visibility: '0',
    //     //     },
    //     //     params:{
    //     //         id: '6437f9af9820a0134ca79c5g',
    //     //     }
    //     // }
    //     // newReqBody.params.id = '6437f9af9820a0134ca79c5g';
    //     const _info = new Information();

    //     _info.infoName = reqBody.infoName;
    //     _info.infoContent = reqBody.infoContent;
    //     _info.visibility = reqBody.visibility;
    //     const info = await _info.save();
    //     const informations = [
    //             {
    //                 _id: info._id,
    //                 infoName: info.infoName,
    //                 infoContent: info.infoContent,
    //                 visibility: info.visibility,
    //             }
    //     ]
    //     cache.setCache('informations', JSON.stringify(informations));
    //     reqBody = {
    //         ...reqBody,
    //         params:{
    //             id:info._id,
    //         }
    //     }
    //     const response = await agent
    //       .delete(`/api/informations/${info._id}`)
    //       .set('Authorization', adminToken)
    //       .send(reqBody)
    //       .expect(200);

    //     expect(response.body).toEqual(
    //         {
    //         _id: info._id,
    //         // __v: expect.anything(),
    //         infoName: info.infoName,
    //         infoContent: info.infoContent,
    //         visibility: info.visibility,
    //     });
    // });
  });
  describe('Update Information route', () => {
    it('Should return 400 if the route does not exist', async () => {
      await agent
        .put('/api/informations/random123')
        .send(reqBody)
        .set('Authorization', adminToken)
        .expect(400);
    });
    // it('Should return 200 if udapted successfully', async () => {
    //     const _info = new Information();
    //     _info.infoName = reqBody.infoName;
    //     _info.infoContent = reqBody.infoContent;
    //     _info.visibility = reqBody.visibility;
    //     const info = await _info.save();
    //     const response = await agent
    //       .put(`/api/informations/${info._id}`)
    //       .set('Authorization', adminToken)
    //       .send(reqBody)
    //       .expect(200);
    //     expect(response.body).toEqual(anything);
    //             //     {
    //             //     _id: info._id,
    //             //     __v: expect.anything(),
    //             //     infoName: info.infoName,
    //             //     infoContent: info.infoContent,
    //             //     visibility: info.visibility,
    //             // });
    // });
  });
});
