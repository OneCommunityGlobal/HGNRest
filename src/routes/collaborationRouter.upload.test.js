jest.mock('../controllers/collaborationController', () => {
  const ok = (req, res) => res.status(200).json({});
  return {
    createForm: ok,
    getAllFormsFormat: ok,
    updateFormFormat: ok,
    getFormFormat: ok,
    getFormResponses: ok,
    submitFormResponse: jest.fn((req, res) =>
      res.status(201).json({ files: (req.files || []).map((f) => f.fieldname) }),
    ),
    addQuestion: ok,
    updateQuestion: ok,
    deleteQuestion: ok,
    reorderQuestions: ok,
    deleteForm: ok,
    importQuestionsFromSet: ok,
  };
});

const express = require('express');
const request = require('supertest');
const formController = require('../controllers/collaborationController');
const collaborationRouter = require('./collaborationRouter');

const app = express();
app.use('/api', collaborationRouter);

const URL = '/api/jobforms/507f1f77bcf86cd799439011/responses';

describe('POST /api/jobforms/:formId/responses upload limits', () => {
  beforeEach(() => jest.clearAllMocks());

  it('hands a valid PDF resume to submitFormResponse', async () => {
    const res = await request(app).post(URL).attach('resume', Buffer.from('%PDF'), {
      filename: 'resume.pdf',
      contentType: 'application/pdf',
    });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ files: ['resume'] });
  });

  it('rejects an oversized resume with 413 before reaching the controller', async () => {
    const res = await request(app)
      .post(URL)
      .attach('resume', Buffer.alloc(5 * 1024 * 1024 + 1), {
        filename: 'resume.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: 'File too large, max 5 MB.' });
    expect(formController.submitFormResponse).not.toHaveBeenCalled();
  });

  it('rejects an unexpected file field with 400 before reaching the controller', async () => {
    const res = await request(app)
      .post(URL)
      .attach('avatar', Buffer.from('x'), { filename: 'a.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Unexpected file field.' });
    expect(formController.submitFormResponse).not.toHaveBeenCalled();
  });
});
