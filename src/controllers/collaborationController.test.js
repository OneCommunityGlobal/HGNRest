jest.mock('../models/JobApplicationEmailRecipients');
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
const JobApplicationEmailRecipients = require('../models/JobApplicationEmailRecipients');
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
    JobApplicationEmailRecipients.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        recipients: [],
      }),
    });
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

    emailSender.mockResolvedValue('Confirmation email sent');

    await submitFormResponse({ params: { formId }, body: validBody }, res);

    expect(saveMock).toHaveBeenCalled();
    expect(emailSender).toHaveBeenCalledWith(
      ['ada@example.com'],
      'Application Received — Software Developer',
      expect.any(String),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('sends submitted answers to configured admin recipients', async () => {
    const questionId = '507f1f77bcf86cd799439012';

    Form.findById.mockResolvedValue({
      _id: formId,
      title: 'Software Developer',
      questions: [
        {
          _id: questionId,
          questionText: 'Why do you want to volunteer?',
        },
      ],
    });

    Response.findOne.mockResolvedValue(null);

    JobApplicationEmailRecipients.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        recipients: ['admin@example.com', 'manager@example.com'],
      }),
    });

    await submitFormResponse(
      {
        params: { formId },
        body: {
          respondent: 'Test Applicant',
          email: 'applicant@example.com',
          answers: [
            {
              questionId,
              answer: 'I want to contribute to the community.',
            },
          ],
        },
      },
      res,
    );

    expect(saveMock).toHaveBeenCalled();
    expect(emailSender).toHaveBeenCalledTimes(2);

    expect(emailSender).toHaveBeenNthCalledWith(
      1,
      ['applicant@example.com'],
      'Application Received — Software Developer',
      expect.any(String),
    );

    expect(emailSender).toHaveBeenNthCalledWith(
      2,
      ['admin@example.com', 'manager@example.com'],
      'New Job Application — Software Developer',
      expect.stringContaining('Why do you want to volunteer?'),
    );

    const adminEmailBody = emailSender.mock.calls[1][2];

    expect(adminEmailBody).toContain('I want to contribute to the community.');
    expect(adminEmailBody).toContain('applicant@example.com');
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('still saves the application when admin notification delivery fails', async () => {
    Form.findById.mockResolvedValue({
      _id: formId,
      title: 'Software Developer',
      questions: [],
    });

    Response.findOne.mockResolvedValue(null);

    JobApplicationEmailRecipients.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        recipients: ['admin@example.com'],
      }),
    });

    emailSender
      .mockResolvedValueOnce('Applicant confirmation sent')
      .mockRejectedValueOnce(new Error('Admin email delivery failed'));

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await submitFormResponse(
        {
          params: { formId },
          body: validBody,
        },
        res,
      );

      expect(saveMock).toHaveBeenCalled();
      expect(emailSender).toHaveBeenCalledTimes(2);
      expect(res.status).toHaveBeenCalledWith(201);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Application submitted successfully.',
        }),
      );
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it('includes submitted questions and safely escaped answers in the applicant email', async () => {
    const questionId = '507f1f77bcf86cd799439012';

    Form.findById.mockResolvedValue({
      _id: formId,
      title: 'Software Developer',
      questions: [
        {
          _id: questionId,
          questionText: 'Why do you want to volunteer?',
        },
      ],
    });

    Response.findOne.mockResolvedValue(null);

    await submitFormResponse(
      {
        params: { formId },
        body: {
          respondent: 'Test Applicant',
          email: 'applicant@example.com',
          answers: [
            {
              questionId,
              answer: '<script>alert("test")</script>',
            },
          ],
        },
      },
      res,
    );

    expect(saveMock).toHaveBeenCalled();
    expect(emailSender).toHaveBeenCalledTimes(1);

    expect(emailSender).toHaveBeenCalledWith(
      ['applicant@example.com'],
      'Application Received — Software Developer',
      expect.stringContaining('Why do you want to volunteer?'),
    );

    const emailBody = emailSender.mock.calls[0][2];

    expect(emailBody).toContain('&lt;script&gt;alert(&quot;test&quot;)&lt;/script&gt;');
    expect(emailBody).not.toContain('<script>');
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('includes resume, question upload, and profile metadata in both emails', async () => {
    const questionId = '507f1f77bcf86cd799439012';
    Form.findById.mockResolvedValue({
      _id: formId,
      title: 'Software Developer',
      questions: [{ _id: questionId, questionText: 'Upload a cover letter' }],
    });
    Response.findOne.mockResolvedValue(null);
    JobApplicationEmailRecipients.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ recipients: ['admin@example.com'] }),
    });
    uploadFileToAzureBlobStorage
      .mockResolvedValueOnce('https://private.example/resume?token=hidden')
      .mockResolvedValueOnce('https://private.example/cover?token=hidden');

    await submitFormResponse(
      {
        params: { formId },
        body: {
          respondent: 'Test Applicant',
          email: 'applicant@example.com',
          answers: [{ questionId, answer: 'Attached my cover letter' }],
        },
        files: [
          {
            fieldname: 'resume',
            originalname: 'resume.pdf',
            mimetype: 'application/pdf',
            size: 123,
            buffer: Buffer.from('resume'),
          },
          {
            fieldname: `questionFile_${questionId}`,
            originalname: 'cover.pdf',
            mimetype: 'application/pdf',
            size: 456,
            buffer: Buffer.from('cover'),
          },
        ],
      },
      res,
    );

    expect(saveMock).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(emailSender).toHaveBeenCalledTimes(2);
    emailSender.mock.calls.forEach(([, , html]) => {
      expect(html).toContain('Upload a cover letter');
      expect(html).toContain('Uploaded file: resume.pdf');
      expect(html).toContain('Uploaded file: cover.pdf');
      expect(html).toContain('File type: application/pdf');
      expect(html).toContain('File size (bytes): 123');
      expect(html).toContain('File size (bytes): 456');
      expect(html).toContain('Applicant Information');
      expect(html).toContain('applicant@example.com');
      expect(html).not.toContain('private.example');
      expect(html).not.toContain('token=hidden');
    });

    emailSender.mock.calls.forEach(([, , html, attachments]) => {
      expect(attachments).toHaveLength(2);

      expect(attachments).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            filename: 'resume.pdf',
            contentType: 'application/pdf',
            content: Buffer.from('resume'),
          }),
          expect.objectContaining({
            filename: 'cover.pdf',
            contentType: 'application/pdf',
            content: Buffer.from('cover'),
          }),
        ]),
      );

      expect(html).not.toContain('could not be attached');
    });
  });

  it('still saves when applicant email fails and admin email succeeds', async () => {
    Form.findById.mockResolvedValue({ _id: formId, title: 'Software Developer' });
    Response.findOne.mockResolvedValue(null);
    JobApplicationEmailRecipients.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ recipients: ['admin@example.com'] }),
    });
    emailSender.mockRejectedValueOnce(new Error('Applicant mail failed'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await submitFormResponse({ params: { formId }, body: validBody }, res);
      expect(saveMock).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(emailSender).toHaveBeenCalledTimes(2);
      expect(emailSender.mock.calls[1][0]).toEqual(['admin@example.com']);
    } finally {
      consoleSpy.mockRestore();
    }
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
            applicantName: 'Test Applicant',
            applicantEmail: 'applicant@example.com',
            profile: {
              locationTimezone: 'Houston, TX, US | America/New_York',
              phone: '555-0100',
              jobTitle: 'SOFTWARE POSITION',
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
            originalname: 'Applicant_Resume.pdf',
            mimetype: 'application/pdf',
            size: 87900,
            buffer: Buffer.from('resume'),
          },
          {
            fieldname: `questionFile_${questionId}`,
            originalname: 'Applicant_Cover_Letter.pdf',
            mimetype: 'application/pdf',
            size: 12923,
            buffer: Buffer.from('cover'),
          },
        ],
      },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(201);
    expect(savedDoc.email).toBe('applicant@example.com');
    expect(savedDoc.resumeUrl).toBe('https://blob/resume.pdf');
    expect(savedDoc.answers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          questionId,
          answer: expect.objectContaining({
            fileName: 'Applicant_Cover_Letter.pdf',
            url: 'https://blob/cover.pdf',
          }),
        }),
        expect.objectContaining({
          answer: expect.objectContaining({
            type: 'applicantProfile',
            applicantName: 'Test Applicant',
            jobTitle: 'SOFTWARE POSITION',
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

  it('omits an oversized attachment and explains the omission in both emails', async () => {
    const questionId = '507f1f77bcf86cd799439012';

    Form.findById.mockResolvedValue({
      _id: formId,
      title: 'Software Developer',
      questions: [{ _id: questionId, questionText: 'Upload a document' }],
    });
    Response.findOne.mockResolvedValue(null);

    JobApplicationEmailRecipients.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        recipients: ['admin@example.com'],
      }),
    });

    const oversizedFile = {
      fieldname: `questionFile_${questionId}`,
      originalname: 'large.pdf',
      mimetype: 'application/pdf',
      buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
    };

    await submitFormResponse(
      {
        params: { formId },
        body: {
          respondent: 'Test Applicant',
          email: 'applicant@example.com',
          answers: [{ questionId, answer: 'Document attached' }],
        },
        files: [oversizedFile],
      },
      res,
    );

    expect(saveMock).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(emailSender).toHaveBeenCalledTimes(2);

    emailSender.mock.calls.forEach(([, , html, attachments]) => {
      expect(html).toContain('1 uploaded file(s) could not be attached');
      expect(attachments).toBeUndefined();
      expect(html).not.toContain('https://blob/');
    });
  });

  it('does not attach unrelated uploaded fields', async () => {
    Form.findById.mockResolvedValue({
      _id: formId,
      title: 'Software Developer',
      questions: [],
    });
    Response.findOne.mockResolvedValue(null);

    await submitFormResponse(
      {
        params: { formId },
        body: validBody,
        files: [
          {
            fieldname: 'unrelatedFile',
            originalname: 'unrelated.pdf',
            mimetype: 'application/pdf',
            buffer: Buffer.from('unrelated content'),
          },
          {
            fieldname: 'resume',
            originalname: 'resume.pdf',
            mimetype: 'application/pdf',
            buffer: Buffer.from('resume content'),
          },
        ],
      },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(201);
    expect(emailSender).toHaveBeenCalledTimes(1);

    const attachments = emailSender.mock.calls[0][3];

    expect(attachments).toHaveLength(1);
    expect(attachments[0].filename).toBe('resume.pdf');
    expect(attachments[0].content).toEqual(Buffer.from('resume content'));
  });

  it('keeps the saved application when email delivery with attachments fails', async () => {
    Form.findById.mockResolvedValue({
      _id: formId,
      title: 'Software Developer',
      questions: [],
    });
    Response.findOne.mockResolvedValue(null);

    JobApplicationEmailRecipients.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        recipients: ['admin@example.com'],
      }),
    });

    emailSender.mockRejectedValue(new Error('Email delivery failed'));

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await submitFormResponse(
        {
          params: { formId },
          body: validBody,
          files: [
            {
              fieldname: 'resume',
              originalname: 'resume.pdf',
              mimetype: 'application/pdf',
              buffer: Buffer.from('resume content'),
            },
          ],
        },
        res,
      );

      expect(saveMock).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(emailSender).toHaveBeenCalledTimes(2);

      emailSender.mock.calls.forEach(([, , , attachments]) => {
        expect(attachments).toHaveLength(1);
        expect(attachments[0].filename).toBe('resume.pdf');
      });
    } finally {
      consoleSpy.mockRestore();
    }
  });
});
