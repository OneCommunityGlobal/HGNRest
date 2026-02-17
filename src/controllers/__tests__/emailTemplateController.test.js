jest.mock('../../services/announcements/emails/emailTemplateService');
jest.mock('../../utilities/permissions');

const EmailTemplateService = require('../../services/announcements/emails/emailTemplateService');
const { hasPermission } = require('../../utilities/permissions');
const {
  getAllEmailTemplates,
  getEmailTemplateById,
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
  previewTemplate,
} = require('../emailTemplateController');

describe('emailTemplateController', () => {
  let req;
  let res;

  beforeEach(() => {
    req = {
      body: {
        requestor: { requestorId: 'user-1' },
      },
      params: {},
      query: {},
      user: { userid: 'user-1' },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    jest.clearAllMocks();
  });

  // ── getAllEmailTemplates ─────────────────────────────────────────────
  describe('getAllEmailTemplates', () => {
    it('should return 401 when no requestor', async () => {
      req.body.requestor = undefined;
      req.user = undefined;
      await getAllEmailTemplates(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 403 when no permission', async () => {
      hasPermission.mockResolvedValue(false);
      await getAllEmailTemplates(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 200 with templates', async () => {
      hasPermission.mockResolvedValue(true);
      EmailTemplateService.getAllTemplates.mockResolvedValue([{ name: 'T1' }]);
      await getAllEmailTemplates(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, templates: [{ name: 'T1' }] }),
      );
    });

    it('should pass search/sort options', async () => {
      hasPermission.mockResolvedValue(true);
      req.query = {
        search: 'welcome',
        sortBy: 'name',
        sortOrder: 'desc',
        includeEmailContent: 'true',
      };
      EmailTemplateService.getAllTemplates.mockResolvedValue([]);
      await getAllEmailTemplates(req, res);
      expect(EmailTemplateService.getAllTemplates).toHaveBeenCalledWith(
        expect.objectContaining({ $or: expect.any(Array) }),
        expect.objectContaining({ sort: { name: -1 } }),
      );
    });

    it('should return 500 on service error', async () => {
      hasPermission.mockResolvedValue(true);
      EmailTemplateService.getAllTemplates.mockRejectedValue(new Error('DB down'));
      await getAllEmailTemplates(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ── getEmailTemplateById ────────────────────────────────────────────
  describe('getEmailTemplateById', () => {
    it('should return 401 when no requestor', async () => {
      req.body.requestor = undefined;
      req.user = undefined;
      await getEmailTemplateById(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 403 when no permission', async () => {
      hasPermission.mockResolvedValue(false);
      await getEmailTemplateById(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 200 with template', async () => {
      hasPermission.mockResolvedValue(true);
      req.params.id = 'template-123';
      EmailTemplateService.getTemplateById.mockResolvedValue({ name: 'T1' });
      await getEmailTemplateById(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 404 when not found', async () => {
      hasPermission.mockResolvedValue(true);
      req.params.id = 'bad-id';
      const notFoundError = new Error('Template not found');
      notFoundError.statusCode = 404;
      EmailTemplateService.getTemplateById.mockRejectedValue(notFoundError);
      await getEmailTemplateById(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  // ── createEmailTemplate ─────────────────────────────────────────────
  describe('createEmailTemplate', () => {
    it('should return 401 when no requestor', async () => {
      req.body.requestor = undefined;
      await createEmailTemplate(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 403 when no permission', async () => {
      hasPermission.mockResolvedValue(false);
      await createEmailTemplate(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 201 on success', async () => {
      hasPermission.mockResolvedValue(true);
      req.body.name = 'Welcome';
      req.body.subject = 'Welcome!';
      req.body.html_content = '<p>Hi</p>';
      EmailTemplateService.createTemplate.mockResolvedValue({ _id: 'new-1', name: 'Welcome' });
      await createEmailTemplate(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should return 400 on validation error', async () => {
      hasPermission.mockResolvedValue(true);
      const validationError = new Error('Invalid template data');
      validationError.statusCode = 400;
      validationError.errors = ['Name is required'];
      EmailTemplateService.createTemplate.mockRejectedValue(validationError);
      await createEmailTemplate(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ── updateEmailTemplate ─────────────────────────────────────────────
  describe('updateEmailTemplate', () => {
    it('should return 401 when no requestor', async () => {
      req.body.requestor = undefined;
      await updateEmailTemplate(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 403 when no permission', async () => {
      hasPermission.mockResolvedValue(false);
      await updateEmailTemplate(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 200 on success', async () => {
      hasPermission.mockResolvedValue(true);
      req.params.id = 'template-123';
      req.body.name = 'Updated';
      EmailTemplateService.updateTemplate.mockResolvedValue({ name: 'Updated' });
      await updateEmailTemplate(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 404 when not found', async () => {
      hasPermission.mockResolvedValue(true);
      req.params.id = 'bad-id';
      const notFoundError = new Error('Not found');
      notFoundError.statusCode = 404;
      EmailTemplateService.updateTemplate.mockRejectedValue(notFoundError);
      await updateEmailTemplate(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  // ── deleteEmailTemplate ─────────────────────────────────────────────
  describe('deleteEmailTemplate', () => {
    it('should return 401 when no requestor', async () => {
      req.body.requestor = undefined;
      await deleteEmailTemplate(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 403 when no permission', async () => {
      hasPermission.mockResolvedValue(false);
      await deleteEmailTemplate(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 200 on success', async () => {
      hasPermission.mockResolvedValue(true);
      req.params.id = 'template-123';
      EmailTemplateService.deleteTemplate.mockResolvedValue();
      await deleteEmailTemplate(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 404 when not found', async () => {
      hasPermission.mockResolvedValue(true);
      req.params.id = 'bad-id';
      const notFoundError = new Error('Not found');
      notFoundError.statusCode = 404;
      EmailTemplateService.deleteTemplate.mockRejectedValue(notFoundError);
      await deleteEmailTemplate(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  // ── previewTemplate ─────────────────────────────────────────────────
  describe('previewTemplate', () => {
    it('should return 401 when no requestor', async () => {
      req.body.requestor = undefined;
      req.user = undefined;
      await previewTemplate(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 403 when no permission', async () => {
      hasPermission.mockResolvedValue(false);
      await previewTemplate(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 400 on invalid variables', async () => {
      hasPermission.mockResolvedValue(true);
      req.params.id = 'template-123';
      req.body.variables = {};
      EmailTemplateService.getTemplateById.mockResolvedValue({ _id: 'template-123' });
      EmailTemplateService.validateVariables.mockReturnValue({
        isValid: false,
        errors: ['Missing firstName'],
        missing: ['firstName'],
      });
      await previewTemplate(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 200 with preview', async () => {
      hasPermission.mockResolvedValue(true);
      req.params.id = 'template-123';
      req.body.variables = { firstName: 'John' };
      EmailTemplateService.getTemplateById.mockResolvedValue({ _id: 'template-123' });
      EmailTemplateService.validateVariables.mockReturnValue({ isValid: true });
      EmailTemplateService.renderTemplate.mockReturnValue({
        subject: 'Hello John',
        html_content: '<p>Hi John</p>',
      });
      await previewTemplate(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should return 500 on service error', async () => {
      hasPermission.mockResolvedValue(true);
      req.params.id = 'template-123';
      EmailTemplateService.getTemplateById.mockRejectedValue(new Error('DB error'));
      await previewTemplate(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
