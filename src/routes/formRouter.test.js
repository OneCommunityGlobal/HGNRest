const request = require('supertest');
const { app } = require('../app');
const { 
  createUser , 
  mongoHelper: { dbConnect, dbDisconnect, dbClearCollections, dbClearAll }, 
  jwtPayload 
} = require('../test'); // Importing necessary utilities
const Form = require('../models/forms.js');
const FormResponse = require('../models/formResponse.js');

const agent = request.agent(app);

describe('Form Routes', () => {
  let user;
  let token;
  let reqBody;
  let createdFormId;

  beforeAll(async () => {
    await dbConnect();
    user = await createUser (); // Create a user for testing
    token = jwtPayload(user); // Generate a token for this user
    reqBody = {
      formName: 'Sample Form',
      questions: [
        { label: 'What is your name?', type: 'text' },
        { label: 'Choose your hobbies', type: 'checkbox', options: ['Reading', 'Traveling', 'Cooking'] },
      ],
      createdBy: user._id,
    };
  });

  beforeEach(async () => {
    await dbClearCollections('forms');
    await dbClearCollections('formresponses');
  });

  afterAll(async () => {
    await dbClearAll();
    await dbDisconnect();
  });

  describe('Create Form Route', () => {
    it('should return 201 if the form is successfully created', async () => {
      const response = await agent
        .post('/api/form/createform')
        .send(reqBody)
        .set('Authorization', `Bearer ${token}`);

      // Log the response for debugging
      console.log('Response Body:', response.body);
      console.log('Response Status:', response.status);

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        formID: expect.any(String),
        formName: reqBody.formName,
        questions: reqBody.questions,
        createdBy: reqBody.createdBy,
        createdAt: expect.any(String),
        __v: expect.any(Number),
      });

      createdFormId = response.body.formID; // Save the created form ID for later tests
    });
  });

  describe('Get All Forms Route', () => {
    it('should return a list of all forms', async () => {
      const response = await agent
        .get('/api/form/allforms')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Submit Form Data Route', () => {
    it('should add data to a form', async () => {
      const formData = {
        formId: createdFormId,
        response: { answer: 'Test answer' },
      };
      const response = await agent
        .post('/api/form/submit')
        .send(formData)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', 'Data submitted successfully');
    });
  });

  describe('Edit Form Format Route', () => {
    it('should edit form format', async () => {
      const editData = {
        formId: createdFormId,
        newFormat: { title: 'Updated Sample Form' },
      };
      const response = await agent
        .post('/api/form/edit')
        .send(editData)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Form format updated successfully');
    });
  });

  describe('Delete Form Format Route', () => {
    it('should delete a form format', async () => {
      const response = await agent
        .delete('/api/form/delete')
        .send({ formId: createdFormId })
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Form deleted successfully');
    });
  });

  describe('Check Form Response Status Route', () => {
    it('should check if user has responded to a specific form', async () => {
      const response = await agent
        .get(`/api/form/status?formId=${createdFormId}&userId=${user._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('hasResponded', expect.any(Boolean));
    });
  });

  describe('Get Form by ID Route', () => {
    it('should return the form details when a valid form ID is provided', async () => {
      const response = await agent
        .get(`/api/form/${createdFormId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        formID: createdFormId,
        formName: reqBody.formName,
        questions: reqBody.questions,
        createdBy: reqBody.createdBy,
        createdAt: expect.any(String),
        __v: expect.any(Number),
      });
    });

    it('should return 404 if the form ID is invalid', async () => {
      const invalidFormId = '507f1f77bcf86cd799439011'; // Example of an invalid ObjectId
      const response = await agent
        .get(`/api/form/${invalidFormId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', 'Form not found');
    });
  });

  describe('Error Handling', () => {
    it('should return 401 if no token is provided', async () => {
      const response = await agent
        .post('/api/form/createform')
        .send(reqBody);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', 'Authorization token is required');
    });

    it('should return 400 if required fields are missing', async () => {
      const invalidReqBody = {
        formName: 'Invalid Form', // Missing questions and createdBy
      };

      const response = await agent
        .post('/api/form/createform')
        .send(invalidReqBody)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', 'Validation failed: questions and createdBy are required');
    });
  });
});