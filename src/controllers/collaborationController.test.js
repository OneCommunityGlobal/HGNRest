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

  const originalJobApplicationDefaultEmail = process.env.JOB_APPLICATION_DEFAULT_EMAIL;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JOB_APPLICATION_DEFAULT_EMAIL = 'default@example.com';
    JobApplicationEmailRecipients.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        recipients: [],
      }),
    });
    res = createMockRes();
    saveMock = jest.fn().mockResolvedValue(true);
    Form.findById = jest.fn();
    Response.findOne = jest.fn();
    Response.countDocuments = jest.fn().mockResolvedValue(1);
    Response.mockImplementation((data) => ({ ...data, save: saveMock }));
    emailSender.mockResolvedValue('ok');
    uploadFileToAzureBlobStorage.mockResolvedValue('https://blob/resume.pdf');
  });

  afterAll(() => {
    if (originalJobApplicationDefaultEmail === undefined) {
      delete process.env.JOB_APPLICATION_DEFAULT_EMAIL;
    } else {
      process.env.JOB_APPLICATION_DEFAULT_EMAIL = originalJobApplicationDefaultEmail;
    }
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

  it('returns 400 when the email domain ending is not a real TLD', async () => {
    await submitFormResponse(
      { params: { formId }, body: { ...validBody, email: 'rabstu@gmail.con' } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: '".con" isn\'t a valid email domain ending. Check for a typo.',
    });
    expect(Form.findById).not.toHaveBeenCalled();
    expect(Response.findOne).not.toHaveBeenCalled();
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

  describe('duplicate application', () => {
    const successBody = { message: 'Application submitted successfully.' };
    const resumeFile = {
      originalname: 'resume.pdf',
      buffer: Buffer.from('pdf'),
      mimetype: 'application/pdf',
    };

    it('returns the same 201 body as a new submission', async () => {
      Form.findById.mockResolvedValue({ _id: formId, title: 'Software Developer' });
      Response.findOne.mockResolvedValue(null);
      await submitFormResponse({ params: { formId }, body: validBody }, res);
      const newRes = res;

      const dupRes = createMockRes();
      Response.findOne.mockResolvedValue({ _id: 'existing' });
      await submitFormResponse({ params: { formId }, body: validBody }, dupRes);

      expect(Response.findOne).toHaveBeenLastCalledWith({
        formId,
        $or: [{ email: 'ada@example.com' }, { respondent: 'ada@example.com' }],
      });
      expect(newRes.status).toHaveBeenCalledWith(201);
      expect(newRes.json).toHaveBeenCalledWith(successBody);
      expect(dupRes.status).toHaveBeenCalledWith(201);
      expect(dupRes.json).toHaveBeenCalledWith(successBody);
      expect(dupRes.json.mock.calls[0]).toEqual(newRes.json.mock.calls[0]);
    });

    it('does not save a second Response or upload files', async () => {
      Form.findById.mockResolvedValue({ _id: formId, title: 'Software Developer' });
      Response.findOne.mockResolvedValue({ _id: 'existing' });

      await submitFormResponse({ params: { formId }, body: validBody, file: resumeFile }, res);

      expect(Response).not.toHaveBeenCalled();
      expect(saveMock).not.toHaveBeenCalled();
      expect(uploadFileToAzureBlobStorage).not.toHaveBeenCalled();
    });

    it('emails the normalized address with escaped values', async () => {
      Form.findById.mockResolvedValue({ _id: formId, title: 'Dev <b>Role</b>' });
      Response.findOne.mockResolvedValue({ _id: 'existing' });

      await submitFormResponse(
        {
          params: { formId },
          body: { ...validBody, respondent: '<script>alert("x")</script> & Co' },
        },
        res,
      );

      expect(emailSender).toHaveBeenCalledTimes(1);
      const [to, subject, html] = emailSender.mock.calls[0];
      expect(to).toEqual(['ada@example.com']);
      expect(subject).toContain('Already Received');
      expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; Co');
      expect(html).toContain('Dev &lt;b&gt;Role&lt;/b&gt;');
      expect(html).not.toContain('<script>');
      expect(html).not.toContain('<b>Role</b>');
    });

    it('still returns the identical 201 when the email fails', async () => {
      Form.findById.mockResolvedValue({ _id: formId, title: 'Software Developer' });
      Response.findOne.mockResolvedValue({ _id: 'existing' });
      emailSender.mockRejectedValue(new Error('smtp down'));
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await submitFormResponse({ params: { formId }, body: validBody }, res);

      expect(errorSpy).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(successBody);
      errorSpy.mockRestore();
    });
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
    expect(res.json).toHaveBeenCalledWith({ message: 'Application submitted successfully.' });
  });

  it('escapes applicant name and form title in the confirmation email HTML', async () => {
    Form.findById.mockResolvedValue({
      _id: formId,
      title: 'Dev <script>alert(1)</script>',
    });
    Response.findOne.mockResolvedValue(null);

    await submitFormResponse(
      {
        params: { formId },
        body: { ...validBody, respondent: '<a href="https://evil.example">click</a>' },
      },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(201);
    const html = emailSender.mock.calls[0][2];
    expect(html).not.toContain('<a href="https://evil.example"');
    expect(html).not.toContain('<script>');
    expect(html).toContain(
      'Dear &lt;a href=&quot;https://evil.example&quot;&gt;click&lt;/a&gt;,',
    );
    expect(html).toContain('Dev &lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('With Gratitude,');
    expect(html).toContain('Jae Sabol');
    expect(html).toContain('https://www.tinyurl.com/zoomoc');
  });

  it('keeps ordinary applicant names readable in the confirmation email', async () => {
    Form.findById.mockResolvedValue({ _id: formId, title: 'Software Developer' });
    Response.findOne.mockResolvedValue(null);

    await submitFormResponse(
      { params: { formId }, body: { ...validBody, respondent: 'José Núñez-Ochoa' } },
      res,
    );

    const html = emailSender.mock.calls[0][2];
    expect(html).toContain('Dear José Núñez-Ochoa,');
    expect(html).toContain('&quot;Software Developer&quot;');
    expect(html).toContain('With Gratitude,');
    expect(html).toContain('(310) 755-4693');
  });

  it('strips CR/LF and control characters from the confirmation email subject', async () => {
    Form.findById.mockResolvedValue({
      _id: formId,
      title: 'Dev\r\nBcc: victim@example.com\u0000',
    });
    Response.findOne.mockResolvedValue(null);

    await submitFormResponse({ params: { formId }, body: validBody }, res);

    const subject = emailSender.mock.calls[0][1];
    expect(subject).toBe('Application Received — DevBcc: victim@example.com');
    expect(subject).not.toMatch(/[\r\n]/);
  });

  it('defaults staff notifications to onecommunityglobal@gmail.com like blue-square mail', async () => {
    delete process.env.JOB_APPLICATION_DEFAULT_EMAIL;

    Form.findById.mockResolvedValue({
      _id: formId,
      title: 'Software Developer',
      questions: [],
    });
    Response.findOne.mockResolvedValue(null);
    JobApplicationEmailRecipients.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        recipients: ['cc@example.com'],
      }),
    });

    await submitFormResponse(
      {
        params: { formId },
        body: {
          respondent: 'Test Applicant',
          email: 'applicant@example.com',
          answers: [],
        },
      },
      res,
    );

    expect(emailSender).toHaveBeenNthCalledWith(
      2,
      ['onecommunityglobal@gmail.com'],
      'New Job Application — Software Developer',
      expect.any(String),
      null,
      ['cc@example.com', 'applicant@example.com'],
    );
  });

  it('sends submitted answers to the default inbox and CCs configured UI recipients', async () => {
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
        recipients: ['admin@example.com', 'manager@example.com', 'default@example.com'],
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
      ['default@example.com'],
      'New Job Application — Software Developer',
      expect.stringContaining('Why do you want to volunteer?'),
      null,
      ['admin@example.com', 'manager@example.com', 'applicant@example.com'],
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
    expect(emailSender).toHaveBeenCalledTimes(2);

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
      expect(emailSender.mock.calls[1][0]).toEqual(['default@example.com']);
      expect(emailSender.mock.calls[1][4]).toEqual(['admin@example.com', 'ada@example.com']);
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

  it('names stored blobs with the allowlisted lower-cased extension, not the client one', async () => {
    Form.findById.mockResolvedValue({ _id: formId, title: 'Software Developer' });
    Response.findOne.mockResolvedValue(null);
    const questionId = '6a4f01a854e483075a73a6a9';

    await submitFormResponse(
      {
        params: { formId },
        body: { ...validBody, answers: [{ questionId, answer: 'x' }] },
        files: [
          {
            fieldname: 'resume',
            originalname: 'Resume.PDF',
            mimetype: 'application/pdf',
            buffer: Buffer.from('pdf'),
          },
          {
            fieldname: `questionFile_${questionId}`,
            originalname: 'cover.html',
            mimetype: 'text/html',
            buffer: Buffer.from('<p>'),
          },
        ],
      },
      res,
    );

    const blobNames = uploadFileToAzureBlobStorage.mock.calls.map(([, name]) => name);
    expect(blobNames).toHaveLength(2);
    expect(blobNames[0]).toMatch(/^resumes\/software_developer_ada_example_com_\d+\.pdf$/);
    expect(blobNames[1]).toMatch(/_q_6a4f01a854e483075a73a6a9_\d+\.bin$/);
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
      expect(attachments == null).toBe(true);
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
    expect(emailSender).toHaveBeenCalledTimes(2);

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

  describe('confirmation email cap', () => {
    let warnSpy;
    let errorSpy;

    // Per-address count queries carry `email`; the global count does not.
    const mockCounts = ({ address, global }) => {
      Response.countDocuments = jest.fn((query) =>
        Promise.resolve(Object.prototype.hasOwnProperty.call(query, 'email') ? address : global),
      );
    };

    beforeEach(() => {
      Form.findById.mockResolvedValue({ _id: formId, title: 'Software Developer' });
      Response.findOne.mockResolvedValue(null);
      warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('sends the email for the 3rd application from one address in 24 h', async () => {
      mockCounts({ address: 3, global: 3 });
      await submitFormResponse({ params: { formId }, body: validBody }, res);
      // Applicant confirmation + default-inbox staff notification.
      expect(emailSender).toHaveBeenCalledTimes(2);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('skips the confirmation for the 4th application but still notifies the default inbox', async () => {
      mockCounts({ address: 4, global: 4 });
      await submitFormResponse({ params: { formId }, body: validBody }, res);
      expect(saveMock).toHaveBeenCalled();
      expect(emailSender).toHaveBeenCalledTimes(1);
      expect(emailSender).toHaveBeenCalledWith(
        ['default@example.com'],
        'New Job Application — Software Developer',
        expect.any(String),
        null,
        ['ada@example.com'],
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Application submitted successfully.' }),
      );
      const logged = warnSpy.mock.calls.map((call) => call.join(' ')).join('\n');
      expect(logged).not.toContain('ada@example.com');
    });

    it('skips the confirmation when the global daily cap is exceeded but still notifies staff', async () => {
      mockCounts({ address: 1, global: 301 });
      await submitFormResponse({ params: { formId }, body: validBody }, res);
      expect(saveMock).toHaveBeenCalled();
      expect(emailSender).toHaveBeenCalledTimes(1);
      expect(emailSender.mock.calls[0][0]).toEqual(['default@example.com']);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('fails open and sends the email when the count query throws', async () => {
      Response.countDocuments = jest.fn().mockRejectedValue(new Error('db hiccup'));
      await submitFormResponse({ params: { formId }, body: validBody }, res);
      expect(emailSender).toHaveBeenCalledTimes(2);
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });
});
