jest.mock('../models/JobFormsModel');
jest.mock('../models/jobApplicationsModel');
jest.mock('../models/questionSet');
jest.mock('../utilities/AzureBlobImages');
jest.mock('../utilities/emailSender');
jest.mock('../utilities/optionalStaffAuth', () => ({ isAuthenticatedRequest: jest.fn() }));
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
const { isAuthenticatedRequest } = require('../utilities/optionalStaffAuth');
const {
  submitFormResponse,
  getAllFormsFormat,
  getFormFormat,
} = require('./collaborationController');

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

describe('submitFormResponse response bodies', () => {
  const formId = '507f1f77bcf86cd799439011';
  const body = {
    respondent: 'Ada Lovelace',
    email: 'ada@example.com',
    answers: [{ questionId: 'q1', answer: 'yes' }],
  };
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    res = createMockRes();
    Form.findById = jest.fn().mockResolvedValue({ _id: formId, title: 'Software Developer' });
    Response.findOne = jest.fn().mockResolvedValue(null);
    emailSender.mockResolvedValue('ok');
  });

  it('returns only a message on success, never the stored record', async () => {
    Response.mockImplementation((data) => ({
      ...data,
      resumeUrl: 'https://blob/resume.pdf',
      save: jest.fn().mockResolvedValue(true),
    }));

    await submitFormResponse({ params: { formId }, body }, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ message: 'Application submitted successfully.' });
  });

  it('returns a generic 500 without the raw error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    Response.mockImplementation((data) => ({
      ...data,
      save: jest.fn().mockRejectedValue(new Error('mongo://secret-host failed')),
    }));

    await submitFormResponse({ params: { formId }, body }, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Error submitting application.' });
    expect(JSON.stringify(res.json.mock.calls)).not.toContain('secret-host');
    console.error.mockRestore();
  });
});

describe('public job form reads', () => {
  const staff = { _id: 's1', firstName: 'Sam', lastName: 'Staff' };
  const makeForm = (overrides = {}) => ({
    _id: 'f1',
    title: 'Engineer',
    description: 'Build things',
    category: 'Engineering',
    isActive: true,
    settings: { requireLogin: false },
    submissionCount: 7,
    createdBy: staff,
    lastModifiedBy: staff,
    questions: [{ _id: 'q1', questionText: 'Why?', questionType: 'textbox', visible: true }],
    questionSets: [
      {
        _id: 'e1',
        includeAll: true,
        selectedQuestions: [],
        questionSetId: {
          _id: 'qs1',
          name: 'Core',
          category: 'Engineering',
          createdBy: staff,
          lastModifiedBy: staff,
          usageCount: 3,
          questions: [{ _id: 'q2', questionText: 'Skills?', questionType: 'textarea' }],
        },
      },
    ],
    ...overrides,
  });

  const mockListQuery = (forms) => {
    const query = {
      where: jest.fn(() => query),
      equals: jest.fn(() => query),
      populate: jest.fn(() => query),
      sort: jest.fn().mockResolvedValue(forms),
    };
    Form.find = jest.fn(() => query);
    return query;
  };

  let res;
  beforeEach(() => {
    jest.clearAllMocks();
    res = createMockRes();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => console.error.mockRestore());

  it('anonymous list is forced to active forms and carries no staff data', async () => {
    isAuthenticatedRequest.mockReturnValue(false);
    const query = mockListQuery([makeForm()]);

    await getAllFormsFormat(
      { query: { isActive: 'false', createdBy: '507f1f77bcf86cd799439011' } },
      res,
    );

    expect(query.where).toHaveBeenCalledWith('isActive');
    expect(query.equals).toHaveBeenCalledWith(true);
    expect(query.where).not.toHaveBeenCalledWith('createdBy');
    expect(query.populate).not.toHaveBeenCalledWith('createdBy', expect.anything());

    const { forms } = res.json.mock.calls[0][0];
    expect(forms).toHaveLength(1);
    const text = JSON.stringify(forms);
    expect(text).not.toContain('Sam');
    expect(text).not.toContain('createdBy');
    expect(text).not.toContain('lastModifiedBy');
    expect(text).not.toContain('submissionCount');
    expect(forms[0]).toMatchObject({ _id: 'f1', title: 'Engineer', isActive: true });
    expect(forms[0].questions[0].questionText).toBe('Why?');
    expect(forms[0].questionSets[0].questionSetId.questions[0].questionText).toBe('Skills?');
  });

  it('staff list keeps filters and staff names', async () => {
    isAuthenticatedRequest.mockReturnValue(true);
    const forms = [makeForm({ isActive: false })];
    const query = mockListQuery(forms);

    await getAllFormsFormat({ query: { isActive: 'false' } }, res);

    expect(query.equals).toHaveBeenCalledWith(false);
    expect(query.populate).toHaveBeenCalledWith('createdBy', 'firstName lastName');
    expect(query.populate).toHaveBeenCalledWith('lastModifiedBy', 'firstName lastName');
    expect(res.json).toHaveBeenCalledWith({ forms });
    expect(res.json.mock.calls[0][0].forms[0].createdBy.firstName).toBe('Sam');
  });

  it('list 500 hides the raw error', async () => {
    isAuthenticatedRequest.mockReturnValue(false);
    const query = mockListQuery([]);
    query.sort.mockRejectedValue(new Error('db password leaked'));

    await getAllFormsFormat({ query: {} }, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Error fetching all forms format.' });
  });

  it('anonymous getFormFormat returns 404 for an inactive form', async () => {
    isAuthenticatedRequest.mockReturnValue(false);
    Form.findById = jest.fn().mockResolvedValue(makeForm({ isActive: false }));

    await getFormFormat({ params: { formId: 'f1' } }, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Form not found.' });
  });

  it('anonymous getFormFormat of an active form drops staff metadata', async () => {
    isAuthenticatedRequest.mockReturnValue(false);
    Form.findById = jest.fn().mockResolvedValue(makeForm());

    await getFormFormat({ params: { formId: 'f1' } }, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const { form } = res.json.mock.calls[0][0];
    expect(form.title).toBe('Engineer');
    expect(JSON.stringify(form)).not.toContain('createdBy');
    expect(JSON.stringify(form)).not.toContain('lastModifiedBy');
    expect(JSON.stringify(form)).not.toContain('Sam');
  });

  it('staff getFormFormat returns the full form even when inactive', async () => {
    isAuthenticatedRequest.mockReturnValue(true);
    const form = makeForm({ isActive: false });
    Form.findById = jest.fn().mockResolvedValue(form);

    await getFormFormat({ params: { formId: 'f1' } }, res);

    expect(res.json).toHaveBeenCalledWith({ form });
  });

  it('getFormFormat 500 hides the raw error', async () => {
    Form.findById = jest.fn().mockRejectedValue(new Error('cast failure internals'));

    await getFormFormat({ params: { formId: 'bad' } }, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Error fetching form format.' });
  });
});
