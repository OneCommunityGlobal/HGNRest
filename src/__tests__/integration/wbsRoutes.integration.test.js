const request = require('supertest');
const { jwtPayload } = require('../../test');
const { app } = require('../../app');
const Project = require('../../models/project');
const {
  mockReq,
  createUser,
  createRole,
  mongoHelper: { dbConnect, dbDisconnect, dbClearCollections, dbClearAll },
} = require('../../test');

const agent = request.agent(app);

describe('wbsRouter tests', () => {
  let adminUser;
  let volunteerUser;
  let volunteerToken;
  let project;
  let reqBody = {
    ...mockReq.body,
  };

  beforeAll(async () => {
    await dbConnect();
    adminUser = await createUser();
    volunteerUser = await createUser();
    volunteerUser.role = 'Volunteer';
    volunteerToken = jwtPayload(volunteerUser);
    await createRole('Administrator', ['postWbs', 'deleteWbs']);
    await createRole('Volunteer', []);
    const _project = new Project();
    _project.projectName = 'Test project';
    _project.isActive = true;
    _project.createdDatetime = new Date('2024-05-01');
    _project.modifiedDatetime = new Date('2024-05-01');
    _project.category = 'Food';
    project = await _project.save();
  });

  beforeEach(async () => {
    await dbClearCollections('wbs');
    reqBody = {
      ...reqBody,
      wbsName: 'Sample WBS',
      isActive: true,
    };
  });

  afterAll(async () => {
    await dbClearAll();
    await dbDisconnect();
  });

  it('should return 401 if authorization header is not present', async () => {
    await agent.get(`/api/wbs/${project._id}`).send(reqBody).expect(401);
    await agent.post(`/api/wbs/${project._id}`).send(reqBody).expect(401);
    await agent.delete(`/api/wbs/${project._id}`).send(reqBody).expect(401);
    await agent.get(`/api/wbsId/${project._id}`).send(reqBody).expect(401);
    await agent.get('/api/wbs').send(reqBody).expect(401);
  });

  it('should return 404 if the route does not exist', async () => {
    await agent
      .get('/api/wibs/randomId')
      .set('Authorization', volunteerToken)
      .send(reqBody)
      .expect(404);
    await agent
      .post('/api/wibs/randomId')
      .set('Authorization', volunteerToken)
      .send(reqBody)
      .expect(404);
    await agent
      .delete('/api/wibs/randomId')
      .set('Authorization', volunteerToken)
      .send(reqBody)
      .expect(404);
    await agent
      .get('/api/wibsId/randomId')
      .set('Authorization', volunteerToken)
      .send(reqBody)
      .expect(404);
    await agent
      .get('/api/wbs/user/randomId')
      .set('Authorization', volunteerToken)
      .send(reqBody)
      .expect(404);
  });
});
