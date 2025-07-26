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

describe('PopupEditorBackups tests', () => {
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
      await createRole('Administrator', ['createPopup']);
      await createRole('Volunteer', []);
      console.log('Test setup completed');
    } catch (error) {
      console.error('Error in beforeAll:', error);
      throw error;
    }
  }, 60000); // 60 second timeout for beforeAll

  beforeEach(async () => {
    await dbClearCollections('popupEditorBackup');
    reqBody = {
      ...reqBody,
      popupId: '6437f9af9820a0134ca79c5e',
      popupName: 'popupName',
      popupContent: 'some popupContent',
    };
  });
  afterAll(async () => {
    await dbClearAll();
    await dbDisconnect();
  });
  it('should return 401 if authorization header is not present', async () => {
    await agent.post('/api/backup/popupeditors/').send(reqBody).expect(401);
    await agent.get('/api/backup/popupeditors/').send(reqBody).expect(401);
    await agent.post('/api/backup/popupeditor/randomId').send(reqBody).expect(401);
    await agent.get('/api/backup/popupeditor/randomId').send(reqBody).expect(401);
  });
  it('Should return 403 if user does not have permissions', async () => {
    const response = await agent
      .post('/api/backup/popupeditors/')
      .send(reqBody)
      .set('Authorization', volunteerToken)
      .expect(403);
    expect(response.body).toEqual({ error: 'You are not authorized to create new popup' });
  });
  it('Should return 400 if missing popupName', async () => {
    reqBody.popupName = null;
    const response = await agent
      .post('/api/backup/popupeditors/')
      .send(reqBody)
      .set('Authorization', adminToken)
      .expect(400);
    expect(response.body).toEqual({
      error: 'popupName , popupContent are mandatory fields',
    });
  });
  it('Should return 400 if missing popupContent', async () => {
    reqBody.popupContent = null;
    const response = await agent
      .post('/api/backup/popupeditors/')
      .send(reqBody)
      .set('Authorization', adminToken)
      .expect(400);
    expect(response.body).toEqual({
      error: 'popupName , popupContent are mandatory fields',
    });
  });
});
