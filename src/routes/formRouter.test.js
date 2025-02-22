// test/formRoutes.test.js
const request = require('supertest');
const { jwtPayload } = require('../test');
const cache = require('../utilities/nodeCache')();
const { app } = require('../app');
const {
  mockReq,
  createUser,
  mongoHelper: { dbConnect, dbDisconnect, dbClearCollections, dbClearAll },
} = require('../test');

const agent = request.agent(app);

describe('Form Routes', () => {
  let user;
  let token;
  let reqBody;

  beforeAll(async () => {
    await dbConnect();
    user = await createUser();
    token = jwtPayload(user);
    reqBody = {
      formName: 'Survey Form',
      questions: [
        {
          label: 'What is your favorite color?',
          type: 'radio',
          options: ['Red', 'Blue', 'Green'],
        },
      ],
      createdBy: user._id,
    };
  });

  beforeEach(async () => {
    await dbClearCollections('forms', 'formResponses');
  });

  afterAll(async () => {
    await dbClearAll();
    await dbDisconnect();
  });

  describe('POST /api/form/createform', () => {
    it('should return 401 if authorization header is not present', async () => {
      await agent.post('/api/form/createform').send(reqBody).expect(401);
    });

    it('should create a form successfully', async () => {
      const res = await agent
        .post('/api/form/createform')
        .set('Authorization', token)
        .send(reqBody)
        .expect(201);

      expect(res.body).toEqual({
        message: 'Form created successfully',
        formID: expect.any(String),
        id:expect.any(String),
        formLink: expect.stringContaining('/forms/'),
      });
    });

    it('should return 400 if form name or questions are missing', async () => {
      const invalidReqBody = { formName: '', questions: [] };
      const res = await agent
        .post('/api/form/createform')
        .set('Authorization', token)
        .send(invalidReqBody)
        .expect(400);

      expect(res.body).toHaveProperty('message', 'Form name and questions are required.');
    });
  });

  describe('GET /api/form/allforms', () => {
    it('should retrieve all forms', async () => {
      cache.setCache('forms', JSON.stringify([{ formName: 'Survey Form' }]));
      const res = await agent
        .get('/api/form/allforms')
        .set('Authorization', token)
        .expect(200);

      expect(res.body).toHaveProperty('data');
    });
  });

  describe('DELETE /api/form/delete', () => {
    it('should return 400 if the form does not exist', async () => {
      const res = await agent
        .delete('/api/form/delete')
        .set('Authorization', token)
        .send({ formID: 'nonexistentID' })
        .expect(400);

      expect(res.body).toHaveProperty('message', 'Error removing Form.');
    });
  });

  describe('POST /api/form/edit', () => {
    it('should edit a form successfully', async () => {
      const form = await agent
        .post('/api/form/createform')
        .set('Authorization', token)
        .send(reqBody);
      
      const res = await agent
        .post('/api/form/edit')
        .set('Authorization', token)
        .send({
          id: form.body.id,
          formName: reqBody.formName,
          formQuestions: reqBody.questions,
          userId: user._id,
        })
        .expect(200);

      expect(res.body).toHaveProperty('message', 'Form Updated');
    });
  });

  describe('GET /api/form/status', () => {
    it('should check if user has responded to the form', async () => {
      const form = await agent
        .post('/api/form/createform')
        .set('Authorization', token)
        .send(reqBody);
      
      const res = await agent
        .get(`/api/form/status?formID=${form.body.formID}&userID=${user._id}`)
        .set('Authorization', token)
        .expect(400); // Expecting 400 if no responses are found

      expect(res.body).toHaveProperty('message', 'No records Found');
    });
  });

  describe('GET /api/form/:id', () => {
    it('should retrieve form data by ID', async () => {
      const form = await agent
        .post('/api/form/createform')
        .set('Authorization', token)
        .send(reqBody);
      
        formID = form.body.formID;

      // Step 2: Submit a response to the form using the route
      await agent
        .post('/api/form/submit')
        .set('Authorization', token)
        .send({
          formID,
          responses: [{ questionLabel: 'What is your favorite color?', answer: 'Blue' }],
          submittedBy: user._id,
        })
        .expect(201);
            
      const res = await agent
        .get(`/api/form/${form.body.formID}`)
        .set('Authorization', token)
        .expect(200);

      expect(res.body).toHaveProperty('message', 'Responses retrieved successfully');
      expect(res.body).toHaveProperty('formID', form.body.formID);
    });
  });

  describe('POST /api/form/submit', () => {
    it('should add data to a form successfully', async () => {
      const form = await agent
        .post('/api/form/createform')
        .set('Authorization', token)
        .send(reqBody);
      const res = await agent
        .post('/api/form/submit')
        .set('Authorization', token)
        .send({
          formID: form.body.formID,
          responses: [{ questionLabel: reqBody.questions[0].label, answer: 'Blue' }],
          submittedBy: user._id,
        })
        .expect(201);

      expect(res.body).toHaveProperty('message', 'Form response submitted successfully');
      expect(res.body).toHaveProperty('responseID');
    });
  });

  describe('GET /api/form/format/', () => {
    it('should retrieve form format by ID', async () => {
      const form = await agent
        .post('/api/form/createform')
        .set('Authorization', token)
        .send(reqBody);
      
      const res = await agent
        .post(`/api/form/format`)
        .set('Authorization', token)
        .send({
          formID:form.body.formID,
          userId:user._id
        })
        .expect(200);

      expect(res.body).toHaveProperty('data');
    });
  });

});
