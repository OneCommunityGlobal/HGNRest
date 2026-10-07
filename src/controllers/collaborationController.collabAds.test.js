jest.mock('../models/JobFormsModel');
jest.mock('../models/jobApplicationsModel');
jest.mock('../models/questionSet');
jest.mock('../middleware/multerMiddleware', () => ({
  any: jest.fn(() => (req, res, next) => next()),
}));
jest.mock('../utilities/jobFormPermissions', () => ({
  canManageJobForms: jest.fn(),
  canCreateFormQuestions: jest.fn(),
  canEditFormQuestions: jest.fn(),
  canDeleteFormQuestions: jest.fn(),
}));
jest.mock('../utilities/emailSender', () => jest.fn().mockResolvedValue('queued'));

const Form = require('../models/JobFormsModel');
const Response = require('../models/jobApplicationsModel');
const emailSender = require('../utilities/emailSender');
const {
  postFormResponseUpload,
  postFormResponses,
} = require('./collaborationController');

const createMockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('collaborationController collab ads features', () => {
  let res;
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    res = createMockRes();
    process.env.DROPBOX_REFRESH_TOKEN = 'refresh';
    process.env.DROPBOX_APP_KEY = 'key';
    process.env.DROPBOX_APP_SECRET = 'secret';
    process.env.DROPBOX_PATH = '/ResumeUploader-HGN';
    process.env.JOB_APPLICATION_RECIPIENT_EMAIL = 'jobs@example.com';
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('postFormResponseUpload', () => {
    it('returns 400 when no file is uploaded', async () => {
      await postFormResponseUpload({ file: undefined }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'No file uploaded' });
    });

    it('returns 500 when file is larger than 5MB', async () => {
      await postFormResponseUpload(
        { file: { size: 6 * 1024 * 1024, mimetype: 'application/pdf', originalname: 'a.pdf' } },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'File size should be less than or equal to 5MB',
      });
    });

    it('returns 500 for unsupported mime types', async () => {
      await postFormResponseUpload(
        { file: { size: 100, mimetype: 'text/plain', originalname: 'a.txt', buffer: Buffer.from('x') } },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid file type. Please upload a PDF, DOC, DOCX, JPG, PNG, or BMP file.',
      });
    });

    it('uploads to Dropbox and returns shared link data', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          json: async () => ({ access_token: 'token' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'file1' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ url: 'https://dropbox.com/s/file?dl=0' }),
        });

      await postFormResponseUpload(
        {
          file: {
            size: 100,
            mimetype: 'application/pdf',
            originalname: 'resume.pdf',
            buffer: Buffer.from('pdf'),
          },
        },
        res,
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        data: { url: 'https://dropbox.com/s/file?dl=0' },
      });
    });

    it('maps Dropbox upload errors', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          json: async () => ({ access_token: 'token' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          text: async () =>
            JSON.stringify({ error: { '.tag': 'path_conflict' }, error_summary: 'conflict' }),
        });

      await postFormResponseUpload(
        {
          file: {
            size: 100,
            mimetype: 'application/pdf',
            originalname: 'resume.pdf',
            buffer: Buffer.from('pdf'),
          },
        },
        res,
      );

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'A file with this name already exists in Dropbox.',
      });
    });

    it('maps shared-link Dropbox errors and malformed token text', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          json: async () => ({ access_token: 'token' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'file1' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          text: async () => 'malformed access token',
        });

      await postFormResponseUpload(
        {
          file: {
            size: 100,
            mimetype: 'image/png',
            originalname: 'img.png',
            buffer: Buffer.from('img'),
          },
        },
        res,
      );

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Dropbox access token is malformed. Please re-authenticate.',
      });
    });

    it('returns 500 when fetch throws', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('network'));

      await postFormResponseUpload(
        {
          file: {
            size: 100,
            mimetype: 'application/pdf',
            originalname: 'resume.pdf',
            buffer: Buffer.from('pdf'),
          },
        },
        res,
      );

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Error Uploading' }),
      );
    });
  });

  describe('postFormResponses', () => {
    const formId = '507f1f77bcf86cd799439011';
    const questionId = '507f1f77bcf86cd799439012';

    it('returns 400 for invalid formId or answers', async () => {
      await postFormResponses({ body: { formId: 'bad', answers: [] } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 404 when form is missing', async () => {
      Form.findById.mockResolvedValue(null);
      await postFormResponses(
        {
          body: {
            formId,
            answers: [{ questionId, answer: 'A' }],
          },
        },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns 404 for invalid question IDs', async () => {
      Form.findById.mockResolvedValue({
        title: 'Engineer Form',
        questions: [{ _id: questionId, questionText: 'Name', isRequired: true }],
      });

      await postFormResponses(
        {
          body: {
            formId,
            answers: [{ questionId: '507f1f77bcf86cd799439099', answer: 'A' }],
          },
        },
        res,
      );

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('Invalid question ID') }),
      );
    });

    it('returns 400 when required answers are missing', async () => {
      Form.findById.mockResolvedValue({
        title: 'Engineer Form',
        questions: [
          { _id: questionId, questionText: 'Name', isRequired: true },
          { _id: '507f1f77bcf86cd799439013', questionText: 'Email', isRequired: true },
        ],
      });

      await postFormResponses(
        {
          body: {
            formId,
            answers: [
              { questionId, answer: 'Applicant' },
              { questionId: '507f1f77bcf86cd799439013', answer: '' },
            ],
          },
        },
        res,
      );

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('Answer required') }),
      );
    });

    it('saves responses and sends email', async () => {
      Form.findById.mockResolvedValue({
        title: 'Engineer Form',
        questions: [
          { _id: questionId, questionText: 'Name', isRequired: true },
          { _id: '507f1f77bcf86cd799439013', questionText: 'Email', isRequired: false },
        ],
      });
      const saved = { _id: 'resp1' };
      Response.mockImplementation(() => ({
        save: jest.fn().mockResolvedValue(saved),
      }));

      await postFormResponses(
        {
          body: {
            formId,
            answers: [
              { questionId, answer: 'Applicant' },
              { questionId: '507f1f77bcf86cd799439013', answer: 'a@example.com' },
            ],
          },
        },
        res,
      );

      expect(emailSender).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Responses submitted successfully.' }),
      );
    });

    it('returns 500 when save fails', async () => {
      Form.findById.mockResolvedValue({
        title: 'Engineer Form',
        questions: [{ _id: questionId, questionText: 'Name', isRequired: false }],
      });
      Response.mockImplementation(() => ({
        save: jest.fn().mockRejectedValue(new Error('db down')),
      }));

      await postFormResponses(
        {
          body: {
            formId,
            answers: [{ questionId, answer: 'Applicant' }],
          },
        },
        res,
      );

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
