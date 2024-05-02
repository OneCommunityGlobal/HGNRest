const request = require('supertest');
const { jwtPayload } = require('../test');
const { app } = require('../app');
const Project = require('../models/project');
const WBS = require('../models/wbs');
const {
  mockReq,
  createUser,
  createRole,
  mongoHelper: { dbConnect, dbDisconnect, dbClearCollections, dbClearAll },
} = require('../test');

const agent = request.agent(app);

describe('actionItem routes', () => {
  let adminUser;
  let volunteerUser;
  let adminToken;
  let volunteerToken;
  const reqBody = {
    ...mockReq.body,
  };

  beforeAll(async () => {
    await dbConnect();
    adminUser = await createUser();
    volunteerUser = await createUser();
    volunteerUser.role = 'Volunteer';
    adminToken = jwtPayload(adminUser);
    volunteerToken = jwtPayload(volunteerUser);

    // create 2 roles. One with permission and one without
    await createRole('Administrator', ['postWbs', 'deleteWbs']);
    await createRole('Volunteer', []);
  });

  beforeEach(async () => {
    await dbClearCollections('actionItems');
  });

  afterAll(async () => {
    await dbClearAll();
    await dbDisconnect();
  });

  describe('wbsRouter tests', () => {
    it('should return 401 if authorization header is not present', async () => {
      await agent.get('/api/wbs/randomId').send(reqBody).expect(401);
      await agent.post('/api/wbs/randomId').send(reqBody).expect(401);
      await agent.delete('/api/wbs/randomId').send(reqBody).expect(401);
      await agent.get('/api/wbsId/randomId').send(reqBody).expect(401);
      await agent.get('/api/wbs/user/randomId').send(reqBody).expect(401);
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
        .get('/api/wibs/user/randomId')
        .set('Authorization', volunteerToken)
        .send(reqBody)
        .expect(404);
      await agent.get('/api/wibs').set('Authorization', volunteerToken).send(reqBody).expect(404);
    });

    describe('getAllWBS routes', () => {
      it.only("Should return 200 and an array of wbs' on success", async () => {
        // create a project and give it some wbs tasks.
        const _project = new Project();
        _project.projectName = 'Test project';
        _project.isActive = true;
        _project.createdDatetime = new Date('2024-05-01');
        _project.modifiedDatetime = new Date('2024-05-01');
        _project.category = 'Food';

        const project = await _project.save();

        // now we create a wbs for the project
        const _wbs = new WBS();

        _wbs.wbsName = 'Sample WBS';
        _wbs.projectId = project._id;
        _wbs.isActive = true;
        _wbs.createdDatetime = new Date('2024-05-01');
        _wbs.modifiedDatetime = new Date('2024-05-01');

        const wbs = await _wbs.save();

        const response = await agent
          .get(`/api/wbs/${project._id}`)
          .set('Authorization', adminToken)
          .send(reqBody)
          .expect(200);

        // Compare with the expected value
        expect(response.body).toEqual([
          {
            _id: expect.anything(),
            modifiedDatetime: expect.anything(),
            wbsName: wbs.wbsName,
            isActive: wbs.isActive,
          },
        ]);
      });
    });
  });
});
