jest.mock('../models/JobFormsModel');
jest.mock('../models/jobApplicationsModel');
jest.mock('../models/questionSet');
jest.mock('../utilities/AzureBlobImages');
jest.mock('../utilities/emailSender');
jest.mock('../utilities/jobFormPermissions', () => ({
  canManageJobForms: jest.fn(),
  canCreateFormQuestions: jest.fn(),
  canEditFormQuestions: jest.fn(),
  canDeleteFormQuestions: jest.fn(),
}));
jest.mock('../middleware/multerMiddleware', () => ({
  single: jest.fn(() => (req, res, next) => next && next()),
  any: jest.fn(() => (req, res, next) => next && next()),
}));

const Form = require('../models/JobFormsModel');
const Response = require('../models/jobApplicationsModel');
const { uploadFileToAzureBlobStorage } = require('../utilities/AzureBlobImages');
const emailSender = require('../utilities/emailSender');
const { submitFormResponse } = require('./collaborationController');

const createMockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('submitFormResponse', () => {
  const formId = '507f1f77bcf86cd799439011';
  let res;
  let saveMock;

  beforeEach(() => {
    jest.clearAllMocks();
    res = createMockRes();
    saveMock = jest.fn().mockResolvedValue(true);
    Form.findById = jest.fn();
    Response.findOne = jest.fn();
    Response.mockImplementation((data) => ({ ...data, save: saveMock }));
    emailSender.mockResolvedValue('ok');
    uploadFileToAzureBlobStorage.mockResolvedValue('https://blob/resume.pdf');
  });

  const validBody = {
    respondent: 'Ada Lovelace',
    email: 'Ada@Example.com',
    answers: [{ questionId: 'q1', answer: 'yes' }],
  };

  it('returns 400 when required fields are missing', async () => {
    await submitFormResponse({ params: { formId }, body: { respondent: 'Ada' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'respondent, email, and answers are required.',
    });
  });

  it('returns 400 for invalid payload JSON', async () => {
    await submitFormResponse({ params: { formId }, body: { payload: '{bad json' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid application payload.' });
  });

  it('returns 400 for invalid answers JSON string', async () => {
    await submitFormResponse(
      {
        params: { formId },
        body: { respondent: 'Ada', email: 'ada@example.com', answers: '{bad json' },
      },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'answers must be a valid JSON array.' });
  });

  it('returns 500 when saving the response fails', async () => {
    Form.findById.mockResolvedValue({ _id: formId, title: 'Software Developer' });
    Response.findOne.mockResolvedValue(null);
    saveMock.mockRejectedValue(new Error('db down'));

    await submitFormResponse({ params: { formId }, body: validBody }, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Error submitting application.' }),
    );
  });

  it('returns 404 when the form does not exist', async () => {
    Form.findById.mockResolvedValue(null);
    await submitFormResponse({ params: { formId }, body: validBody }, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Form not found.' });
  });

  it('returns 409 when the email already applied to this form', async () => {
    Form.findById.mockResolvedValue({ _id: formId, title: 'Software Developer' });
    Response.findOne.mockResolvedValue({ _id: 'existing' });
    await submitFormResponse({ params: { formId }, body: validBody }, res);
    expect(Response.findOne).toHaveBeenCalledWith({
      formId,
      $or: [{ email: 'ada@example.com' }, { respondent: 'ada@example.com' }],
    });
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: 'Application already submitted.' });
  });

  it('returns 201, saves email, and sends a confirmation email', async () => {
    Form.findById.mockResolvedValue({ _id: formId, title: 'Software Developer' });
    Response.findOne.mockResolvedValue(null);

    await submitFormResponse({ params: { formId }, body: validBody }, res);

    expect(saveMock).toHaveBeenCalled();
    expect(emailSender).toHaveBeenCalledWith(
      ['ada@example.com'],
      'Application Received — Software Developer',
      expect.stringContaining('Ada Lovelace'),
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Application submitted successfully.',
      }),
    );
  });

  it('parses answers JSON strings and stores resumeUrl when a file is uploaded', async () => {
    Form.findById.mockResolvedValue({ _id: formId, title: 'Software Developer' });
    Response.findOne.mockResolvedValue(null);

    await submitFormResponse(
      {
        params: { formId },
        body: {
          ...validBody,
          answers: JSON.stringify(validBody.answers),
        },
        file: {
          originalname: 'resume.pdf',
          buffer: Buffer.from('pdf'),
          mimetype: 'application/pdf',
        },
      },
      res,
    );

    expect(uploadFileToAzureBlobStorage).toHaveBeenCalled();
    expect(saveMock).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('still returns 201 if resume upload or email sending fails', async () => {
    Form.findById.mockResolvedValue({ _id: formId, title: 'Software Developer' });
    Response.findOne.mockResolvedValue(null);
    uploadFileToAzureBlobStorage.mockRejectedValue(new Error('azure down'));
    emailSender.mockRejectedValue(new Error('smtp down'));

    await submitFormResponse(
      {
        params: { formId },
        body: validBody,
        file: {
          originalname: 'resume.pdf',
          buffer: Buffer.from('pdf'),
          mimetype: 'application/pdf',
        },
      },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('accepts the site payload format and stores question-file uploads', async () => {
    Form.findById.mockResolvedValue({ _id: formId, title: 'Software Developer' });
    Response.findOne.mockResolvedValue(null);
    uploadFileToAzureBlobStorage
      .mockResolvedValueOnce('https://blob/resume.pdf')
      .mockResolvedValueOnce('https://blob/cover.pdf');

    let savedDoc;
    Response.mockImplementation((data) => {
      savedDoc = data;
      return { ...data, save: saveMock };
    });

    const questionId = '6a4f01a854e483075a73a6a9';
    await submitFormResponse(
      {
        params: { formId },
        body: {
          payload: JSON.stringify({
            applicantName: 'Purav Jignesh Patel',
            applicantEmail: 'purav13pat@gmail.com',
            profile: {
              locationTimezone: 'Houston, TX, US | America/New_York',
              phone: '+1 2813091557',
              jobTitle: 'APPLIED THROUGH SITE - SEEKING SOFTWARE POSITION',
            },
            answers: [
              { questionId: '6a4f01a854e483075a73a69e', answer: 'Individual' },
              { questionId, answer: { fileName: 'Cover_Letter.pdf', size: 12923 } },
            ],
          }),
        },
        files: [
          {
            fieldname: 'resume',
            originalname: 'Purav Patel_Resume.pdf',
            mimetype: 'application/pdf',
            size: 87900,
            buffer: Buffer.from('resume'),
          },
          {
            fieldname: `questionFile_${questionId}`,
            originalname: 'Cover_Letter_Purav Jignesh Patel.pdf',
            mimetype: 'application/pdf',
            size: 12923,
            buffer: Buffer.from('cover'),
          },
        ],
      },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(201);
    expect(savedDoc.email).toBe('purav13pat@gmail.com');
    expect(savedDoc.resumeUrl).toBe('https://blob/resume.pdf');
    expect(savedDoc.answers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          questionId,
          answer: expect.objectContaining({
            fileName: 'Cover_Letter_Purav Jignesh Patel.pdf',
            url: 'https://blob/cover.pdf',
          }),
        }),
        expect.objectContaining({
          answer: expect.objectContaining({
            type: 'applicantProfile',
            applicantName: 'Purav Jignesh Patel',
            jobTitle: 'APPLIED THROUGH SITE - SEEKING SOFTWARE POSITION',
          }),
        }),
      ]),
    );
  });

  it('stores question-file metadata without url when upload fails', async () => {
    Form.findById.mockResolvedValue({ _id: formId, title: 'Software Developer' });
    Response.findOne.mockResolvedValue(null);
    uploadFileToAzureBlobStorage.mockRejectedValue(new Error('azure down'));

    let savedDoc;
    Response.mockImplementation((data) => {
      savedDoc = data;
      return { ...data, save: saveMock };
    });

    const questionId = '6a4f01a854e483075a73a6a9';
    await submitFormResponse(
      {
        params: { formId },
        body: {
          respondent: 'Ada Lovelace',
          email: 'ada@example.com',
          answers: [{ questionId, answer: 'cover letter' }],
        },
        files: [
          {
            fieldname: `questionFile_${questionId}`,
            originalname: 'cover.pdf',
            mimetype: 'application/pdf',
            size: 100,
            buffer: Buffer.from('cover'),
          },
        ],
      },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(201);
    expect(savedDoc.answers[0].answer).toEqual(
      expect.objectContaining({ fileName: 'cover.pdf', mimeType: 'application/pdf' }),
    );
    expect(savedDoc.answers[0].answer.url).toBeUndefined();
  });
});
