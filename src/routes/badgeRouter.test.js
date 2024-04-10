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
    await createRole('Administrator', [
      'createBadges',
      'seeBadges',
      'assignBadges',
      'deleteBadges',
      'updateBadges',
    ]);
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
      await agent.put(`/api/badge/assign/randomId`).send(reqBody).expect(401);
      await agent.delete('/api/badge/randomid').send(reqBody).expect(401);
    });

    it('Should return 404 if the route does not exist', async () => {
      await agent.post('/api/badges').send(reqBody).set('Authorization', adminToken).expect(404);
      await agent.get('/api/badges').send(reqBody).set('Authorization', adminToken).expect(404);
      await agent
        .put(`/api/badges/assign/randomId`)
        .set('Authorization', adminToken)
        .send(reqBody)
        .expect(404);
      await agent
        .delete(`/api/badges/randomId`)
        .set('Authorization', adminToken)
        .send(reqBody)
        .expect(404);
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

      expect(response.text).toEqual('You are not authorized to view all badge data.');
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

  describe('assign badge route', () => {
    it('Should return 403 if the user does not have permission', async () => {
      const response = await agent
        .put(`/api/badge/assign/${adminUser._id}`)
        .send(reqBody)
        .set('Authorization', volunteerToken)
        .expect(403);

      expect(response.text).toEqual('You are not authorized to assign badges.');
    });

    it('Should return 400 if no user was found', async () => {
      const response = await agent
        .put(`/api/badge/assign/601acda376045c7879d13a74`)
        .send(reqBody)
        .set('Authorization', adminToken)
        .expect(400);

      expect(response.text).toEqual('Can not find the user to be assigned.');
    });

    it('Should return 201 if the user was successfully updated', async () => {
      reqBody.badgeCollection = [
        {
          badge: '609c930f7d8f8086e72c501a', // Example ObjectId for badge
          count: 5,
          earnedDate: ['2023-01-01', '2023-02-15'],
          lastModified: new Date('2023-02-15'),
          hasBadgeDeletionImpact: true,
          featured: false,
        },
        {
          badge: '609c930f7d8f8086e72c501b', // Example ObjectId for badge
          count: 10,
          earnedDate: ['2023-03-20'],
          lastModified: new Date('2023-03-20'),
          hasBadgeDeletionImpact: false,
          featured: true,
        },
        {
          badge: '609c930f7d8f8086e72c501c', // Example ObjectId for badge
          count: 3,
          earnedDate: [],
          lastModified: new Date('2023-04-05'),
          hasBadgeDeletionImpact: true,
          featured: false,
        },
      ];

      const response = await agent
        .put(`/api/badge/assign/${volunteerUser._id}`)
        .send(reqBody)
        .set('Authorization', adminToken)
        .expect(201);

      expect(response.text).toBe(JSON.stringify(volunteerUser._id));
    });
  });

  describe('delete badge route', () => {
    it('should return 403 if the user does not have permission', async () => {
      const response = await agent
        .delete(`/api/badge/${adminUser._id}`)
        .send(reqBody)
        .set('Authorization', volunteerToken)
        .expect(403);

      expect(response.body).toEqual({ error: 'You are not authorized to delete badges.' });
    });

    it('Should return 400 if no badge was found', async () => {
      const response = await agent
        .delete(`/api/badge/${adminUser._id}`)
        .send(reqBody)
        .set('Authorization', adminToken)
        .expect(400);

      expect(response.body).toEqual({ error: 'No valid records found' });
    });

    it('Should return 200 if all is successful', async () => {
      // create a new badge to be removed
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

      const badge = await _badge.save();

      const response = await agent
        .delete(`/api/badge/${badge._id}`)
        .send(reqBody)
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body).toEqual({
        message: 'Badge successfully deleted and user profiles updated',
      });
    });
  });
});
