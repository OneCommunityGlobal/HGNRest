// test/formController.spec.js
const { createForm, editFormFormat, deleteFormFormat, checkForResponse, getFormData, addDataToForm, getAllForms, getFormFormat } = require('./formController')(
    require('../models/forms.js'), 
    require('../models/formResponse.js')
  );
  const Form = require('../models/forms');
  const FormResponse = require('../models/formResponse');
  const UserProfile = require('../models/userProfile');
  
  jest.mock('../models/forms');
  jest.mock('../models/formResponse');
  jest.mock('../models/userProfile');
  
  describe('Form Controller', () => {
    let req, res;
  
    beforeEach(() => {
      req = { body: {}, params: {}, query: {} };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
    });
  
    describe('createForm', () => {
      it('should create a form successfully', async () => {
        req.body = { formName: 'Test Form', questions: ['Question 1'], createdBy: 'user123' };
  
        Form.prototype.save = jest.fn().mockResolvedValue({ formID: 'form123', _id: 'testId' });
  
        await createForm(req, res);
  
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({
          message: 'Form created successfully',
          formID: 'form123',
          id: 'testId',
          formLink: expect.stringContaining('/forms/'),
        });
      });
  
      it('should return 400 if formName or questions are missing', async () => {
        req.body = { formName: '', questions: [] };
  
        await createForm(req, res);
  
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: 'Form name and questions are required.' });
      });
    });
  
    describe('editFormFormat', () => {
      it('should edit a form successfully', async () => {
        req.body = { id: 'testId', formName: 'Updated Form', formQuestions: ['New Question'], userId: 'user123' };
        Form.findById = jest.fn().mockResolvedValue({ _id: 'testId' });
        UserProfile.findById = jest.fn().mockResolvedValue({ _id: 'user123', isActive: true });
        Form.updateOne = jest.fn().mockResolvedValue({});
  
        await editFormFormat(req, res);
  
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ message: 'Form Updated' });
      });
  
      it('should return 400 if form does not exist', async () => {
        Form.findById = jest.fn().mockResolvedValue(null);
  
        await editFormFormat(req, res);
  
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: 'Invalid FormID' });
      });
  
      it('should return 400 if user is inactive', async () => {
        Form.findById = jest.fn().mockResolvedValue({ _id: 'testId' });
        UserProfile.findById = jest.fn().mockResolvedValue({ isActive: false });
  
        await editFormFormat(req, res);
  
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: 'Invalid userid' });
      });
    });
  
    describe('deleteFormFormat', () => {
      it('should delete a form successfully', async () => {
        req.body = { formID: 'testId' };
        Form.deleteOne = jest.fn().mockResolvedValue({ deletedCount: 1 });
  
        await deleteFormFormat(req, res);
  
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ message: 'Form Deleted Successfully' });
      });
  
      it('should return 400 if form deletion fails', async () => {
        req.body = { formID: 'invalidId' };
        Form.deleteOne = jest.fn().mockResolvedValue({ deletedCount: 0 });
  
        await deleteFormFormat(req, res);
  
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: 'Error removing Form.' });
      });
    });
  
    describe('checkForResponse', () => {
      it('should return 400 if no responses are found', async () => {
        req.query = { formID: 'form123', userID: 'user123' };
        FormResponse.find = jest.fn().mockResolvedValue([]);
  
        await checkForResponse(req, res);
  
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: 'No records Found' });
      });
  
      it('should return 200 if responses are found', async () => {
        req.query = { formID: 'form123', userID: 'user123' };
        FormResponse.find = jest.fn().mockResolvedValue([{ answer: 'Yes' }]);
  
        await checkForResponse(req, res);
  
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ message: [{ answer: 'Yes' }] });
      });
    });
  
    describe('getFormData', () => {
      it('should retrieve form data with responses successfully', async () => {
        req.params.id = 'form123';
        Form.findOne = jest.fn().mockResolvedValue({ formID: 'form123', formName: 'Test Form' });
        FormResponse.find = jest.fn().mockResolvedValue([{ response: 'Sample Response' }]);
  
        await getFormData(req, res);
  
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
          message: 'Responses retrieved successfully',
          formID: 'form123',
          formName: 'Test Form',
          responses: [{ response: 'Sample Response' }],
        });
      });
    });
  
    describe('addDataToForm', () => {
      it('should add a response to a form successfully', async () => {
        req.body = {
          formID: 'form123',
          responses: [{ questionLabel: 'What is your favorite color?', answer: 'Blue' }],
          submittedBy: 'user123',
        };
        Form.findOne = jest.fn().mockResolvedValue({ formID: 'form123' });
        UserProfile.find = jest.fn().mockResolvedValue([{ _id: 'user123', isActive: true }]);
        FormResponse.prototype.save = jest.fn().mockResolvedValue({ _id: 'response123' });
  
        await addDataToForm(req, res);
  
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({
          message: 'Form response submitted successfully',
          responseID: 'response123',
        });
      });
    });
  
    describe('getAllForms', () => {
      it('should retrieve all forms successfully', async () => {
        Form.find = jest.fn().mockResolvedValue([{ formID: 'form123', formName: 'Test Form' }]);
  
        await getAllForms(req, res);
  
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ data: [{ formID: 'form123', formName: 'Test Form' }] });
      });
    });
  
    describe('getFormFormat', () => {
      it('should retrieve form format successfully', async () => {
        req.params.id = 'form123';
        Form.find = jest.fn().mockResolvedValue([{ formID: 'form123', formName: 'Test Form' }]);
  
        await getFormFormat(req, res);
  
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ data: [{ formID: 'form123', formName: 'Test Form' }] });
      });
    });
  });
  