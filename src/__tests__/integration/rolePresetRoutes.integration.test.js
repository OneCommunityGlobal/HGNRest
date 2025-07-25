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
  beforeAll(async () => {
    await dbConnect();
    adminUser = await createUser();
    volunteerUser = await createUser();
    volunteerUser.role = 'Volunteer';
    adminToken = jwtPayload(adminUser);
    volunteerToken = jwtPayload(volunteerUser);
    await createRole('Administrator', ['putRole']);
    await createRole('Volunteer', []);
  });
  beforeEach(async () => {
    await dbClearCollections('rolePreset');
    reqBody = {
      ...reqBody,
      roleName: 'some roleName',
      presetName: 'some Preset',
      permissions: ['test', 'write'],
    };
  });
  afterAll(async () => {
    await dbClearAll();
    await dbDisconnect();
  });
  it('should return 401 if authorization header is not present', async () => {
    await agent.post('/api/rolePreset').send(reqBody).expect(401);
    await agent.get('/api/rolePreset/randomRoleName').send(reqBody).expect(401);
    await agent.put(`/api/rolePreset/randomId`).send(reqBody).expect(401);
    await agent.delete('/api/rolePreser/randomId').send(reqBody).expect(401);
  });
  it('Should return 403 if user does not have permissions', async () => {
    const response = await agent
      .post('/api/rolePreset')
      .send(reqBody)
      .set('Authorization', volunteerToken)
      .expect(403);
    expect(response.text).toEqual('You are not authorized to make changes to roles.');
  });
  it('Should return 400 if missing roleName', async () => {
    reqBody.roleName = null;
    const response = await agent
      .post('/api/rolePreset')
      .send(reqBody)
      .set('Authorization', adminToken)
      .expect(400);
    expect(response.body).toEqual({
      error: 'roleName, presetName, and permissions are mandatory fields.',
    });
  });
  it('Should return 400 if missing presetName', async () => {
    reqBody.presetName = null;
    const response = await agent
      .post('/api/rolePreset')
      .send(reqBody)
      .set('Authorization', adminToken)
      .expect(400);
    expect(response.body).toEqual({
      error: 'roleName, presetName, and permissions are mandatory fields.',
    });
  });
  it('Should return 400 if missing permissions', async () => {
    reqBody.permissions = null;
    const response = await agent
      .post('/api/rolePreset')
      .send(reqBody)
      .set('Authorization', adminToken)
      .expect(400);
    expect(response.body).toEqual({
      error: 'roleName, presetName, and permissions are mandatory fields.',
    });
  });
});
