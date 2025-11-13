/**
 * Email Template Controller - Handles HTTP requests for email template operations
 */

const EmailTemplateService = require('../services/announcements/emails/emailTemplateService');
const { hasPermission } = require('../utilities/permissions');
const logger = require('../startup/logger');

/**
 * Get all email templates (with basic search/sort and optional content projection).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const getAllEmailTemplates = async (req, res) => {
  try {
    // Permission check - use sendEmails permission to view templates
    if (!req?.body?.requestor?.requestorId && !req?.user?.userid) {
      return res.status(401).json({
        success: false,
        message: 'Missing requestor',
      });
    }

    const requestor = req.body.requestor || req.user;
    const canViewTemplates = await hasPermission(requestor, 'sendEmails');
    if (!canViewTemplates) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view email templates.',
      });
    }

    const { search, sortBy, includeEmailContent } = req.query;

    const query = {};
    const sort = {};

    // Add search functionality
    if (search && search.trim()) {
      query.$or = [{ name: { $regex: search.trim(), $options: 'i' } }];
    }

    // Build sort object
    if (sortBy) {
      sort[sortBy] = 1;
    } else {
      sort.created_at = -1;
    }

    // Build projection
    let projection = '_id name created_by updated_by created_at updated_at';
    if (includeEmailContent === 'true') {
      projection += ' subject html_content variables';
    }

    const templates = await EmailTemplateService.getAllTemplates(query, {
      sort,
      projection,
      populate: true,
    });

    res.status(200).json({
      success: true,
      templates,
    });
  } catch (error) {
    logger.logException(error, 'Error fetching email templates');
    const statusCode = error.statusCode || 500;
    const response = {
      success: false,
      message: error.message || 'Error fetching email templates',
    };
    if (error.errors && Array.isArray(error.errors)) {
      response.errors = error.errors;
    }
    return res.status(statusCode).json(response);
  }
};

/**
 * Get a single email template by ID.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const getEmailTemplateById = async (req, res) => {
  try {
    // Permission check - use sendEmails permission to view templates
    if (!req?.body?.requestor?.requestorId && !req?.user?.userid) {
      return res.status(401).json({
        success: false,
        message: 'Missing requestor',
      });
    }

    const requestor = req.body.requestor || req.user;
    const canViewTemplates = await hasPermission(requestor, 'sendEmails');
    if (!canViewTemplates) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view email templates.',
      });
    }

    const { id } = req.params;

    // Service validates ID and throws error with statusCode if not found
    const template = await EmailTemplateService.getTemplateById(id, {
      populate: true,
    });

    res.status(200).json({
      success: true,
      template,
    });
  } catch (error) {
    logger.logException(error, 'Error fetching email template');
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Error fetching email template',
    });
  }
};

/**
 * Create a new email template.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const createEmailTemplate = async (req, res) => {
  try {
    // Requestor is required for permission check
    if (!req?.body?.requestor?.requestorId) {
      return res.status(401).json({
        success: false,
        message: 'Missing requestor',
      });
    }

    // Permission check - use sendEmails permission to create templates
    const canCreateTemplate = await hasPermission(req.body.requestor, 'sendEmails');
    if (!canCreateTemplate) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to create email templates.',
      });
    }

    const { name, subject, html_content: htmlContent, variables } = req.body;
    const userId = req.body.requestor.requestorId;

    const templateData = {
      name,
      subject,
      html_content: htmlContent,
      variables,
    };

    const template = await EmailTemplateService.createTemplate(templateData, userId);

    res.status(201).json({
      success: true,
      message: 'Email template created successfully',
      template,
    });
  } catch (error) {
    logger.logException(error, 'Error creating email template');
    const statusCode = error.statusCode || 500;
    const response = {
      success: false,
      message: error.message || 'Error creating email template',
    };
    if (error.errors && Array.isArray(error.errors)) {
      response.errors = error.errors;
    }
    return res.status(statusCode).json(response);
  }
};

/**
 * Update an existing email template by ID.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const updateEmailTemplate = async (req, res) => {
  try {
    // Requestor is required for permission check
    if (!req?.body?.requestor?.requestorId) {
      return res.status(401).json({
        success: false,
        message: 'Missing requestor',
      });
    }

    // Permission check - use sendEmails permission to update templates
    const canUpdateTemplate = await hasPermission(req.body.requestor, 'sendEmails');
    if (!canUpdateTemplate) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update email templates.',
      });
    }

    const { id } = req.params;
    const { name, subject, html_content: htmlContent, variables } = req.body;
    const userId = req.body.requestor.requestorId;

    const templateData = {
      name,
      subject,
      html_content: htmlContent,
      variables,
    };

    const template = await EmailTemplateService.updateTemplate(id, templateData, userId);

    res.status(200).json({
      success: true,
      message: 'Email template updated successfully',
      template,
    });
  } catch (error) {
    logger.logException(error, 'Error updating email template');
    const statusCode = error.statusCode || 500;
    const response = {
      success: false,
      message: error.message || 'Error updating email template',
    };
    if (error.errors && Array.isArray(error.errors)) {
      response.errors = error.errors;
    }
    return res.status(statusCode).json(response);
  }
};

/**
 * Delete an email template by ID (hard delete).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const deleteEmailTemplate = async (req, res) => {
  try {
    // Requestor is required for permission check
    if (!req?.body?.requestor?.requestorId) {
      return res.status(401).json({
        success: false,
        message: 'Missing requestor',
      });
    }

    // Permission check - use sendEmails permission to delete templates
    const canDeleteTemplate = await hasPermission(req.body.requestor, 'sendEmails');
    if (!canDeleteTemplate) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to delete email templates.',
      });
    }

    const { id } = req.params;
    const userId = req.body.requestor.requestorId;

    await EmailTemplateService.deleteTemplate(id, userId);

    res.status(200).json({
      success: true,
      message: 'Email template deleted successfully',
    });
  } catch (error) {
    logger.logException(error, 'Error deleting email template');
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Error deleting email template',
    });
  }
};

/**
 * Preview template with variable values.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const previewTemplate = async (req, res) => {
  try {
    // Permission check
    if (!req?.body?.requestor?.requestorId && !req?.user?.userid) {
      return res.status(401).json({
        success: false,
        message: 'Missing requestor',
      });
    }

    const requestor = req.body.requestor || req.user;
    const canViewTemplates = await hasPermission(requestor, 'sendEmails');
    if (!canViewTemplates) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to preview email templates.',
      });
    }

    const { id } = req.params;
    const { variables = {} } = req.body;

    // Service validates ID and throws error with statusCode if not found
    const template = await EmailTemplateService.getTemplateById(id, {
      populate: false,
    });

    // Validate variables
    const validation = EmailTemplateService.validateVariables(template, variables);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid variables',
        errors: validation.errors,
        missing: validation.missing,
      });
    }

    // Render template
    const rendered = EmailTemplateService.renderTemplate(template, variables, {
      sanitize: false, // Don't sanitize for preview
      strict: false,
    });

    res.status(200).json({
      success: true,
      preview: rendered,
    });
  } catch (error) {
    logger.logException(error, 'Error previewing email template');
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Error previewing email template',
    });
  }
};

/**
 * Validate template structure and variables.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const validateTemplate = async (req, res) => {
  try {
    // Permission check
    if (!req?.body?.requestor?.requestorId && !req?.user?.userid) {
      return res.status(401).json({
        success: false,
        message: 'Missing requestor',
      });
    }

    const requestor = req.body.requestor || req.user;
    const canViewTemplates = await hasPermission(requestor, 'sendEmails');
    if (!canViewTemplates) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to validate email templates.',
      });
    }

    const { id } = req.params;

    // Service validates ID and throws error with statusCode if not found
    const template = await EmailTemplateService.getTemplateById(id, {
      populate: false,
    });

    // Validate template data
    const validation = EmailTemplateService.validateTemplateData(template);

    res.status(200).json({
      success: true,
      isValid: validation.isValid,
      errors: validation.errors || [],
    });
  } catch (error) {
    logger.logException(error, 'Error validating email template');
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Error validating email template',
    });
  }
};

module.exports = {
  getAllEmailTemplates,
  getEmailTemplateById,
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
  previewTemplate,
  validateTemplate,
};
