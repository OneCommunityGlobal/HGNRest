const request = require('supertest');
const { jwtPayload } = require('../test');
const { app } = require('../app');
const {
  mockReq,
  createUser,
  createRole,
  mongoHelper: { dbConnect, dbDisconnect, dbClearCollections, dbClearAll },
} = require('../test');
const Badge = require('../models/badge');

const agent = request.agent(app);

describe('actionItem routes', () => {
  let adminUser;
  let volunteerUser;
  let adminToken;
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
    reqBody = {
      ...reqBody,
      badgeName: 'Any badge',
      category: 'Food',
      type: 'No Infringement Streak',
      multiple: 3,
      totalHrs: 55,
      weeks: 1,
      months: 2,
      people: 10,
      project: '601acda376045c7879d13a74',
      imageUrl: 'https://randomURL.com',
      ranking: 3,
      description: 'Any description',
      showReport: true,
    };

    // create 2 roles. One with permission and one without
    await createRole('Administrator', ['createBadges', 'seeBadges']);
    await createRole('Volunteer', []);
  });

  beforeEach(async () => {
    await dbClearCollections('badges');
  });

  afterAll(async () => {
    await dbClearAll();
    await dbDisconnect();
  });

  describe('badgeRoutes', () => {
    it('should return 401 if authorization header is not present', async () => {
      await agent.post('/api/badge').send(reqBody).expect(401);
      await agent.get('/api/badge').send(reqBody).expect(401);
    });

    it('Should return 404 if the route does not exist', async () => {
      await agent.post('/api/badges').send(reqBody).set('Authorization', adminToken).expect(404);
      await agent.get('/api/badges').send(reqBody).set('Authorization', adminToken).expect(404);
    });
  });

  describe('Post badge route', () => {
    it('Should return 403 if user does not have permissions', async () => {
      const response = await agent
        .post('/api/badge')
        .send(reqBody)
        .set('Authorization', volunteerToken)
        .expect(403);

      expect(response.body).toEqual({ error: 'You are not authorized to create new badges.' });
    });

    it('Should return 201 if the badge is successfully created', async () => {
      const response = await agent
        .post('/api/badge')
        .send(reqBody)
        .set('Authorization', adminToken)
        .expect(201);

      expect(response.body).toEqual({
        _id: expect.anything(),
        __v: expect.anything(),
        badgeName: reqBody.badgeName,
        category: reqBody.category,
        multiple: reqBody.multiple,
        totalHrs: reqBody.totalHrs,
        weeks: reqBody.weeks,
        months: reqBody.months,
        people: reqBody.people,
        project: reqBody.project,
        imageUrl: reqBody.imageUrl,
        ranking: reqBody.ranking,
        description: reqBody.description,
        showReport: reqBody.showReport,
        type: reqBody.type,
      });
    });

    it('Should return 400 if another badge with the same name exists', async () => {
      await agent.post('/api/badge').send(reqBody).set('Authorization', adminToken).expect(201);

      const response = await agent
        .post('/api/badge')
        .send(reqBody)
        .set('Authorization', adminToken)
        .expect(400);

      expect(response.body).toEqual({
        error: `Another badge with name ${reqBody.badgeName} already exists. Sorry, but badge names should be like snowflakes, no two should be the same. Please choose a different name for this badge so it can be proudly unique.`,
      });
    });
  });

  describe('getAllBadges route', () => {
    it('Should return 403 if user does not have permissions', async () => {
      const response = await agent
        .get('/api/badge')
        .send(reqBody)
        .set('Authorization', volunteerToken)
        .expect(403);

      expect(response.body).toEqual({ error: 'You are not authorized to view all badge data.' });
    });

    it('Should return 200 and all badges if user has permission and all succeeds', async () => {
      // create new badges
      const _badge = new Badge();

      _badge.badgeName = reqBody.badgeName;
      _badge.category = reqBody.category;
      _badge.multiple = reqBody.multiple;
      _badge.totalHrs = reqBody.totalHrs;
      _badge.weeks = reqBody.weeks;
      _badge.months = reqBody.months;
      _badge.people = reqBody.people;
      _badge.project = reqBody.project;
      _badge.imageUrl = reqBody.imageUrl;
      _badge.ranking = reqBody.ranking;
      _badge.description = reqBody.description;
      _badge.showReport = reqBody.showReport;
      _badge.type = reqBody.type;

      await _badge.save();

      const response = await agent
        .get('/api/badge')
        .send(reqBody)
        .set('Authorization', adminToken)
        .expect(200);

      // console.log(response.body)

      expect(response.body).toEqual([
        {
          _id: expect.anything(),
          badgeName: reqBody.badgeName,
          category: reqBody.category,
          multiple: reqBody.multiple,
          totalHrs: reqBody.totalHrs,
          weeks: reqBody.weeks,
          months: reqBody.months,
          people: reqBody.people,
          project: null,
          imageUrl: reqBody.imageUrl,
          ranking: reqBody.ranking,
          description: reqBody.description,
          showReport: reqBody.showReport,
          type: reqBody.type,
        },
      ]);
    });
  });
});
