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
});
