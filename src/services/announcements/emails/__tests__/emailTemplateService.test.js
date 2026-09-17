const mongoose = require('mongoose');
const EmailTemplateService = require('../emailTemplateService');
const EmailTemplate = require('../../../../models/emailTemplate');
const { EMAIL_CONFIG } = require('../../../../config/emailConfig');

jest.mock('../../../../models/emailTemplate');

describe('EmailTemplateService', () => {
  beforeEach(() => {
    EmailTemplate.findById = jest.fn();
    EmailTemplate.find = jest.fn();
    EmailTemplate.findOne = jest.fn();
    EmailTemplate.findByIdAndUpdate = jest.fn();
    EmailTemplate.findByIdAndDelete = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── validateTemplateVariables ─────────────────────────────────────────
  describe('validateTemplateVariables', () => {
    it('should return valid for null/undefined variables', () => {
      expect(EmailTemplateService.validateTemplateVariables(null)).toEqual({
        isValid: true,
        errors: [],
      });
    });

    it('should return valid for non-array input', () => {
      expect(EmailTemplateService.validateTemplateVariables('bad')).toEqual({
        isValid: true,
        errors: [],
      });
    });

    it('should return valid for well-formed variables', () => {
      const result = EmailTemplateService.validateTemplateVariables([
        { name: 'first_name', type: 'text' },
        { name: 'age', type: 'number' },
      ]);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should flag empty/missing variable name', () => {
      const result = EmailTemplateService.validateTemplateVariables([{ name: '', type: 'text' }]);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('name is required');
    });

    it('should flag invalid variable name format (special chars)', () => {
      const result = EmailTemplateService.validateTemplateVariables([
        { name: 'my-var', type: 'text' },
      ]);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('alphanumeric');
    });

    it('should flag duplicate variable names (case-insensitive)', () => {
      const result = EmailTemplateService.validateTemplateVariables([
        { name: 'Name', type: 'text' },
        { name: 'name', type: 'text' },
      ]);
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('duplicate')]));
    });

    it('should flag missing type', () => {
      const result = EmailTemplateService.validateTemplateVariables([{ name: 'foo' }]);
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('type is required')]),
      );
    });

    it('should flag invalid type', () => {
      const result = EmailTemplateService.validateTemplateVariables([
        { name: 'foo', type: 'invalid_type' },
      ]);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('invalid');
    });
  });

  // ── validateTemplateVariableUsage ─────────────────────────────────────
  describe('validateTemplateVariableUsage', () => {
    it('should return valid when no variables defined', () => {
      const result = EmailTemplateService.validateTemplateVariableUsage([], '<p>hi</p>', 'Subject');
      expect(result.isValid).toBe(true);
    });

    it('should return valid when null variables', () => {
      const result = EmailTemplateService.validateTemplateVariableUsage(null, '<p>hi</p>', 'Sub');
      expect(result.isValid).toBe(true);
    });

    it('should flag undefined variable placeholder in content', () => {
      const result = EmailTemplateService.validateTemplateVariableUsage(
        [{ name: 'firstName' }],
        '<p>Hello {{lastName}}</p>',
        'Hi {{firstName}}',
      );
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('lastName')]));
    });

    it('should flag defined but unused variables', () => {
      const result = EmailTemplateService.validateTemplateVariableUsage(
        [{ name: 'title' }, { name: 'unused_var' }],
        '<p>{{title}}</p>',
        'Subject',
      );
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('unused_var')]),
      );
    });

    it('should pass when all variables are used and defined', () => {
      const result = EmailTemplateService.validateTemplateVariableUsage(
        [{ name: 'name' }, { name: 'role' }],
        '<p>Hello {{name}}</p>',
        'Welcome {{role}}',
      );
      expect(result.isValid).toBe(true);
    });
  });

  // ── validateTemplateData ──────────────────────────────────────────────
  describe('validateTemplateData', () => {
    const validData = {
      name: 'Test Template',
      subject: 'Test Subject',
      html_content: '<p>Hello World</p>',
      variables: [],
    };

    it('should return valid for correct data', () => {
      const result = EmailTemplateService.validateTemplateData(validData);
      expect(result.isValid).toBe(true);
    });

    it('should flag missing name', () => {
      const result = EmailTemplateService.validateTemplateData({ ...validData, name: '' });
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining('name')]));
    });

    it('should flag name exceeding max length', () => {
      const longName = 'x'.repeat(EMAIL_CONFIG.LIMITS.TEMPLATE_NAME_MAX_LENGTH + 1);
      const result = EmailTemplateService.validateTemplateData({ ...validData, name: longName });
      expect(result.isValid).toBe(false);
    });

    it('should flag missing subject', () => {
      const result = EmailTemplateService.validateTemplateData({ ...validData, subject: '' });
      expect(result.isValid).toBe(false);
    });

    it('should flag subject exceeding max length', () => {
      const longSubject = 'x'.repeat(EMAIL_CONFIG.LIMITS.SUBJECT_MAX_LENGTH + 1);
      const result = EmailTemplateService.validateTemplateData({
        ...validData,
        subject: longSubject,
      });
      expect(result.isValid).toBe(false);
    });

    it('should flag missing html_content', () => {
      const result = EmailTemplateService.validateTemplateData({ ...validData, html_content: '' });
      expect(result.isValid).toBe(false);
    });

    it('should flag placeholders in content without variables defined', () => {
      const result = EmailTemplateService.validateTemplateData({
        ...validData,
        html_content: '<p>{{undeclared}}</p>',
        variables: [],
      });
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('variable placeholders');
    });

    it('should validate variables when provided', () => {
      const result = EmailTemplateService.validateTemplateData({
        ...validData,
        html_content: '<p>{{myVar}}</p>',
        variables: [{ name: 'myVar', type: 'text' }],
      });
      expect(result.isValid).toBe(true);
    });
  });

  // ── createTemplate ────────────────────────────────────────────────────
  describe('createTemplate', () => {
    const userId = new mongoose.Types.ObjectId();
    const validData = {
      name: 'Welcome Email',
      subject: 'Welcome!',
      html_content: '<p>Hello</p>',
      variables: [],
    };

    it('should throw 400 when validation fails', async () => {
      await expect(
        EmailTemplateService.createTemplate({ name: '', subject: '', html_content: '' }, userId),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('should throw 400 for invalid userId', async () => {
      await expect(EmailTemplateService.createTemplate(validData, 'bad-id')).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('should throw 409 when template name already exists', async () => {
      // Mock templateNameExists
      EmailTemplate.findOne.mockResolvedValue({ _id: 'existing' });

      await expect(EmailTemplateService.createTemplate(validData, userId)).rejects.toMatchObject({
        statusCode: 409,
      });
    });

    it('should create and return template on success', async () => {
      EmailTemplate.findOne.mockResolvedValue(null);

      jest.spyOn(EmailTemplate.prototype, 'save').mockResolvedValue(undefined);
      jest.spyOn(EmailTemplate.prototype, 'populate').mockResolvedValue(undefined);

      const result = await EmailTemplateService.createTemplate(validData, userId);

      expect(EmailTemplate.prototype.save).toHaveBeenCalled();
      expect(EmailTemplate.prototype.populate).toHaveBeenCalledTimes(2);
      expect(result).toHaveProperty('name', validData.name.trim());
    });

    it('should throw 400 on ValidationError during save', async () => {
      EmailTemplate.findOne.mockResolvedValue(null);

      const dbError = new Error('Validation failed');
      dbError.name = 'ValidationError';

      jest.spyOn(EmailTemplate.prototype, 'save').mockRejectedValue(dbError);
      jest.spyOn(EmailTemplate.prototype, 'populate').mockResolvedValue(undefined);

      await expect(EmailTemplateService.createTemplate(validData, userId)).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('should throw 409 on duplicate key error during save', async () => {
      EmailTemplate.findOne.mockResolvedValue(null);

      const dbError = new Error('dup key');
      dbError.code = 11000;

      jest.spyOn(EmailTemplate.prototype, 'save').mockRejectedValue(dbError);
      jest.spyOn(EmailTemplate.prototype, 'populate').mockResolvedValue(undefined);

      await expect(EmailTemplateService.createTemplate(validData, userId)).rejects.toMatchObject({
        statusCode: 409,
      });
    });
  });

  // ── getTemplateById ───────────────────────────────────────────────────
  describe('getTemplateById', () => {
    it('should throw 400 for invalid id', async () => {
      await expect(EmailTemplateService.getTemplateById('bad')).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('should throw 404 when template not found', async () => {
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
      };
      // The chain: findById().populate().populate() resolves to null
      EmailTemplate.findById.mockReturnValue(mockQuery);
      // The final await on the query resolves to null
      mockQuery.then = (resolve) => resolve(null);

      await expect(
        EmailTemplateService.getTemplateById(new mongoose.Types.ObjectId()),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should return template when found with populate', async () => {
      const templateDoc = { _id: new mongoose.Types.ObjectId(), name: 'Test' };
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
      };
      EmailTemplate.findById.mockReturnValue(mockQuery);
      // Make the query thenable (resolves to templateDoc)
      mockQuery.then = (resolve) => resolve(templateDoc);

      const result = await EmailTemplateService.getTemplateById(templateDoc._id);
      expect(result).toEqual(templateDoc);
      expect(mockQuery.populate).toHaveBeenCalledTimes(2);
    });

    it('should skip populate when populate option is false', async () => {
      const templateDoc = { _id: new mongoose.Types.ObjectId(), name: 'Test' };
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
      };
      EmailTemplate.findById.mockReturnValue(mockQuery);
      mockQuery.then = (resolve) => resolve(templateDoc);

      const result = await EmailTemplateService.getTemplateById(templateDoc._id, {
        populate: false,
      });
      expect(result).toEqual(templateDoc);
      expect(mockQuery.populate).not.toHaveBeenCalled();
    });
  });

  // ── getAllTemplates ────────────────────────────────────────────────────
  describe('getAllTemplates', () => {
    it('should return templates with default options', async () => {
      const templates = [{ name: 'T1' }, { name: 'T2' }];
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(templates),
      };
      EmailTemplate.find.mockReturnValue(mockQuery);

      const result = await EmailTemplateService.getAllTemplates();
      expect(result).toEqual(templates);
    });

    it('should apply projection when provided', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      };
      EmailTemplate.find.mockReturnValue(mockQuery);

      await EmailTemplateService.getAllTemplates({}, { projection: 'name subject' });
      expect(mockQuery.select).toHaveBeenCalledWith('name subject');
    });

    it('should skip populate when populate is false', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      };
      EmailTemplate.find.mockReturnValue(mockQuery);

      await EmailTemplateService.getAllTemplates({}, { populate: false });
      expect(mockQuery.populate).not.toHaveBeenCalled();
    });
  });

  // ── updateTemplate ────────────────────────────────────────────────────
  describe('updateTemplate', () => {
    const userId = new mongoose.Types.ObjectId();
    const templateId = new mongoose.Types.ObjectId();
    const validData = {
      name: 'Updated Template',
      subject: 'Updated Subject',
      html_content: '<p>Updated</p>',
      variables: [],
    };

    it('should throw 400 for invalid id', async () => {
      await expect(
        EmailTemplateService.updateTemplate('bad', validData, userId),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('should throw 400 when validation fails', async () => {
      await expect(
        EmailTemplateService.updateTemplate(templateId, { name: '' }, userId),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('should throw 400 for invalid userId', async () => {
      await expect(
        EmailTemplateService.updateTemplate(templateId, validData, 'bad-id'),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('should throw 404 when template not found', async () => {
      EmailTemplate.findById.mockResolvedValue(null);

      await expect(
        EmailTemplateService.updateTemplate(templateId, validData, userId),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should throw 409 when new name conflicts with another template', async () => {
      // Current template with different name
      EmailTemplate.findById.mockResolvedValue({ _id: templateId, name: 'Original Name' });
      // Another template exists with the new name
      EmailTemplate.findOne.mockResolvedValue({ _id: 'other-id', name: 'Updated Template' });

      await expect(
        EmailTemplateService.updateTemplate(templateId, validData, userId),
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it('should update and return template on success', async () => {
      EmailTemplate.findById.mockResolvedValue({
        _id: templateId,
        name: 'Updated Template', // same name, no conflict check
      });

      const updatedDoc = { _id: templateId, ...validData };
      const mockPopulateChain = {
        populate: jest.fn().mockReturnThis(),
      };
      // Make the chain thenable
      mockPopulateChain.then = (resolve) => resolve(updatedDoc);

      EmailTemplate.findByIdAndUpdate.mockReturnValue(mockPopulateChain);

      const result = await EmailTemplateService.updateTemplate(templateId, validData, userId);
      expect(result).toEqual(updatedDoc);
    });
  });

  // ── deleteTemplate ────────────────────────────────────────────────────
  describe('deleteTemplate', () => {
    it('should throw 400 for invalid id', async () => {
      await expect(EmailTemplateService.deleteTemplate('bad')).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('should throw 404 when template not found', async () => {
      EmailTemplate.findById.mockResolvedValue(null);

      await expect(
        EmailTemplateService.deleteTemplate(new mongoose.Types.ObjectId()),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should delete and return the template', async () => {
      const id = new mongoose.Types.ObjectId();
      const templateDoc = { _id: id, name: 'To Delete' };
      EmailTemplate.findById.mockResolvedValue(templateDoc);
      EmailTemplate.findByIdAndDelete.mockResolvedValue(templateDoc);

      const result = await EmailTemplateService.deleteTemplate(id);
      expect(result).toEqual(templateDoc);
      expect(EmailTemplate.findByIdAndDelete).toHaveBeenCalledWith(id);
    });
  });

  // ── templateNameExists ────────────────────────────────────────────────
  describe('templateNameExists', () => {
    it('should return true when name exists', async () => {
      EmailTemplate.findOne.mockResolvedValue({ name: 'Exists' });

      const result = await EmailTemplateService.templateNameExists('Exists');
      expect(result).toBe(true);
    });

    it('should return false when name does not exist', async () => {
      EmailTemplate.findOne.mockResolvedValue(null);

      const result = await EmailTemplateService.templateNameExists('New Name');
      expect(result).toBe(false);
    });

    it('should exclude a specific ID when provided', async () => {
      const excludeId = new mongoose.Types.ObjectId();
      EmailTemplate.findOne.mockResolvedValue(null);

      await EmailTemplateService.templateNameExists('Name', excludeId);

      const query = EmailTemplate.findOne.mock.calls[0][0];
      expect(query._id.$ne).toEqual(excludeId);
    });
  });

  // ── renderTemplate ────────────────────────────────────────────────────
  describe('renderTemplate', () => {
    it('should throw 400 when template is null', () => {
      expect(() => EmailTemplateService.renderTemplate(null)).toThrow();
    });

    it('should replace {{variable}} placeholders in subject and html', () => {
      const template = {
        subject: 'Hello {{name}}',
        html_content: '<p>Welcome {{name}}, your role is {{role}}</p>',
        variables: [
          { name: 'name', type: 'text' },
          { name: 'role', type: 'text' },
        ],
      };

      const result = EmailTemplateService.renderTemplate(template, {
        name: 'Alice',
        role: 'Admin',
      });

      expect(result.subject).toBe('Hello Alice');
      expect(result.htmlContent).toContain('Welcome Alice');
      expect(result.htmlContent).toContain('Admin');
    });

    it('should leave unreplaced variables when value is undefined (non-strict)', () => {
      const template = {
        subject: '{{greeting}}',
        html_content: '<p>{{greeting}}</p>',
        variables: [{ name: 'greeting', type: 'text' }],
      };

      const result = EmailTemplateService.renderTemplate(template, {});
      expect(result.subject).toBe('{{greeting}}');
    });

    it('should throw in strict mode when variable is missing', () => {
      const template = {
        subject: '{{name}}',
        html_content: '<p>Hi</p>',
        variables: [{ name: 'name', type: 'text' }],
      };

      expect(() => EmailTemplateService.renderTemplate(template, {}, { strict: true })).toThrow(
        'Missing required variable: name',
      );
    });

    it('should sanitize HTML by default', () => {
      const template = {
        subject: 'Test',
        html_content: '<script>alert("xss")</script><p>safe</p>',
        variables: [],
      };

      const result = EmailTemplateService.renderTemplate(template, {});
      expect(result.htmlContent).not.toContain('<script>');
      expect(result.htmlContent).toContain('<p>safe</p>');
    });

    it('should skip sanitization when sanitize is false', () => {
      const template = {
        subject: 'Test',
        html_content: '<script>alert("xss")</script>',
        variables: [],
      };

      const result = EmailTemplateService.renderTemplate(template, {}, { sanitize: false });
      expect(result.htmlContent).toContain('<script>');
    });

    it('should handle image type variables', () => {
      const template = {
        subject: 'Logo',
        html_content: '<img src="{{logo}}" />',
        variables: [{ name: 'logo', type: 'image' }],
      };

      const result = EmailTemplateService.renderTemplate(
        template,
        { logo: 'https://example.com/img.png' },
        { sanitize: false },
      );
      expect(result.htmlContent).toContain('https://example.com/img.png');
    });
  });

  // ── validateVariables ─────────────────────────────────────────────────
  describe('validateVariables', () => {
    it('should return valid when all variables provided', () => {
      const template = { variables: [{ name: 'a' }, { name: 'b' }] };
      const result = EmailTemplateService.validateVariables(template, { a: '1', b: '2' });
      expect(result.isValid).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('should flag missing variables', () => {
      const template = { variables: [{ name: 'required_var' }] };
      const result = EmailTemplateService.validateVariables(template, {});
      expect(result.isValid).toBe(false);
      expect(result.missing).toContain('required_var');
    });

    it('should flag unknown variables', () => {
      const template = { variables: [{ name: 'expected' }] };
      const result = EmailTemplateService.validateVariables(template, {
        expected: 'val',
        extra: 'should not be here',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('Unknown variable')]),
      );
    });

    it('should ignore _extracted suffix variables', () => {
      const template = { variables: [{ name: 'logo' }] };
      const result = EmailTemplateService.validateVariables(template, {
        logo: 'url',
        logo_extracted: 'processed_url',
      });
      expect(result.isValid).toBe(true);
    });
  });

  // ── getUnreplacedVariables ────────────────────────────────────────────
  describe('getUnreplacedVariables', () => {
    it('should return empty array for null/undefined content', () => {
      expect(EmailTemplateService.getUnreplacedVariables(null)).toEqual([]);
      expect(EmailTemplateService.getUnreplacedVariables(undefined)).toEqual([]);
    });

    it('should return empty array for non-string content', () => {
      expect(EmailTemplateService.getUnreplacedVariables(123)).toEqual([]);
    });

    it('should find unreplaced variables', () => {
      const content = '<p>Hello {{name}}, {{role}}</p>';
      const result = EmailTemplateService.getUnreplacedVariables(content);
      expect(result).toEqual(['name', 'role']);
    });

    it('should return unique variable names', () => {
      const content = '<p>{{name}} and {{name}} again</p>';
      const result = EmailTemplateService.getUnreplacedVariables(content);
      expect(result).toEqual(['name']);
    });
  });

  // ── sanitizeHtml ──────────────────────────────────────────────────────
  describe('sanitizeHtml', () => {
    it('should return empty string for null/undefined', () => {
      expect(EmailTemplateService.sanitizeHtml(null)).toBe('');
      expect(EmailTemplateService.sanitizeHtml(undefined)).toBe('');
    });

    it('should strip script tags', () => {
      const result = EmailTemplateService.sanitizeHtml('<script>alert("xss")</script><p>ok</p>');
      expect(result).not.toContain('<script>');
      expect(result).toContain('<p>ok</p>');
    });

    it('should allow safe tags and attributes', () => {
      const html =
        '<a href="https://example.com" target="_blank">Link</a><img src="https://example.com/img.png" alt="img" />';
      const result = EmailTemplateService.sanitizeHtml(html);
      expect(result).toContain('<a');
      expect(result).toContain('href');
      expect(result).toContain('<img');
    });

    it('should allow table elements', () => {
      const html =
        '<table><thead><tr><th>Header</th></tr></thead><tbody><tr><td>Cell</td></tr></tbody></table>';
      const result = EmailTemplateService.sanitizeHtml(html);
      expect(result).toContain('<table>');
      expect(result).toContain('<td>');
    });
  });

  // ── extractVariablesFromContent ───────────────────────────────────────
  describe('extractVariablesFromContent', () => {
    it('should extract variables from subject', () => {
      const template = { subject: '{{greeting}} {{name}}', html_content: '' };
      const result = EmailTemplateService.extractVariablesFromContent(template);
      expect(result).toEqual(expect.arrayContaining(['greeting', 'name']));
    });

    it('should extract variables from html_content', () => {
      const template = { subject: '', html_content: '<p>{{role}}</p>' };
      const result = EmailTemplateService.extractVariablesFromContent(template);
      expect(result).toContain('role');
    });

    it('should extract from both and deduplicate', () => {
      const template = { subject: '{{name}}', html_content: '<p>{{name}} {{age}}</p>' };
      const result = EmailTemplateService.extractVariablesFromContent(template);
      expect(result).toEqual(expect.arrayContaining(['name', 'age']));
      // Ensure 'name' only appears once
      expect(result.filter((v) => v === 'name')).toHaveLength(1);
    });

    it('should return empty array when no variables found', () => {
      const template = { subject: 'Hello', html_content: '<p>World</p>' };
      const result = EmailTemplateService.extractVariablesFromContent(template);
      expect(result).toEqual([]);
    });
  });
});
