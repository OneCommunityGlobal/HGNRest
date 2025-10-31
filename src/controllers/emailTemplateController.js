const mongoose = require('mongoose');
const EmailTemplate = require('../models/emailTemplate');
const { EMAIL_JOB_CONFIG } = require('../config/emailJobConfig');
const { hasPermission } = require('../utilities/permissions');
const logger = require('../startup/logger');
const { ensureHtmlWithinLimit, validateHtmlMedia } = require('../utilities/emailValidators');

/**
 * Validate template variables.
 * - Ensures non-empty unique names and validates allowed types.
 * @param {Array<{name: string, type?: 'text'|'url'|'number'|'textarea'|'image'>} | undefined} variables
 * @returns {{isValid: boolean, errors?: string[]}}
 */
function validateTemplateVariables(variables) {
  if (!variables || !Array.isArray(variables)) {
    return { isValid: true };
  }

  const errors = [];
  const variableNames = new Set();

  variables.forEach((variable, index) => {
    if (!variable.name || typeof variable.name !== 'string' || !variable.name.trim()) {
      errors.push(`Variable ${index + 1}: name is required and must be a non-empty string`);
    } else {
      const varName = variable.name.trim();
      // Validate variable name format (alphanumeric and underscore only)
      if (!/^[a-zA-Z0-9_]+$/.test(varName)) {
        errors.push(
          `Variable ${index + 1}: name must contain only alphanumeric characters and underscores`,
        );
      }
      // Check for duplicates
      if (variableNames.has(varName.toLowerCase())) {
        errors.push(`Variable ${index + 1}: duplicate variable name '${varName}'`);
      }
      variableNames.add(varName.toLowerCase());
    }

    if (variable.type && !['text', 'url', 'number', 'textarea', 'image'].includes(variable.type)) {
      errors.push(`Variable ${index + 1}: type must be one of: text, url, number, textarea, image`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate template content (HTML and subject) against defined variables.
 * - Flags undefined placeholders and unused defined variables.
 * @param {Array<{name: string}>} templateVariables
 * @param {string} htmlContent
 * @param {string} subject
 * @returns {{isValid: boolean, errors: string[]}}
 */
function validateTemplateVariableUsage(templateVariables, htmlContent, subject) {
  const errors = [];

  if (!templateVariables || templateVariables.length === 0) {
    return { isValid: true, errors: [] };
  }

  // Extract variable placeholders from content (format: {{variableName}})
  const variablePlaceholderRegex = /\{\{(\w+)\}\}/g;
  const usedVariables = new Set();
  const foundPlaceholders = [];

  // Check HTML content
  if (htmlContent) {
    let match = variablePlaceholderRegex.exec(htmlContent);
    while (match !== null) {
      const varName = match[1];
      foundPlaceholders.push(varName);
      usedVariables.add(varName);
      match = variablePlaceholderRegex.exec(htmlContent);
    }
  }

  // Reset regex for subject
  variablePlaceholderRegex.lastIndex = 0;

  // Check subject
  if (subject) {
    let match = variablePlaceholderRegex.exec(subject);
    while (match !== null) {
      const varName = match[1];
      foundPlaceholders.push(varName);
      usedVariables.add(varName);
      match = variablePlaceholderRegex.exec(subject);
    }
  }

  // Check for undefined variable placeholders in content
  const definedVariableNames = templateVariables.map((v) => v.name);
  foundPlaceholders.forEach((placeholder) => {
    if (!definedVariableNames.includes(placeholder)) {
      errors.push(
        `Variable placeholder '{{${placeholder}}}' is used in content but not defined in template variables`,
      );
    }
  });

  // Check for defined variables that are not used in content (treated as errors)
  templateVariables.forEach((variable) => {
    if (!usedVariables.has(variable.name)) {
      errors.push(`Variable '{{${variable.name}}}}' is defined but not used in template content`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}

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

    // Add search functionality with text index
    if (search && search.trim()) {
      query.$or = [{ name: { $regex: search.trim(), $options: 'i' } }];
    }

    // Build sort object - let frontend decide sort field and order
    if (sortBy) {
      sort[sortBy] = 1; // default ascending when sortBy provided
    } else {
      // Default sort only if frontend doesn't specify
      sort.created_at = -1;
    }

    // Build projection based on include flags; always include audit fields
    let projection = '_id name created_by updated_by created_at updated_at';
    if (includeEmailContent === 'true') projection += ' subject html_content variables';

    let queryBuilder = EmailTemplate.find(query).select(projection).sort(sort);

    // Always include created_by and updated_by populations
    queryBuilder = queryBuilder.populate('created_by', 'firstName lastName');
    queryBuilder = queryBuilder.populate('updated_by', 'firstName lastName');

    const templates = await queryBuilder.lean();

    res.status(200).json({
      success: true,
      templates,
    });
  } catch (error) {
    logger.logException(error, 'Error fetching email templates');
    res.status(500).json({
      success: false,
      message: 'Error fetching email templates',
      error: error.message,
    });
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

    // Validate ObjectId
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid template ID',
      });
    }

    const template = await EmailTemplate.findById(id)
      .populate('created_by', 'firstName lastName email')
      .populate('updated_by', 'firstName lastName email');

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Email template not found',
      });
    }

    res.status(200).json({
      success: true,
      template,
    });
  } catch (error) {
    logger.logException(error, 'Error fetching email template');
    res.status(500).json({
      success: false,
      message: 'Error fetching email template',
      error: error.message,
    });
  }
};

/**
 * Create a new email template.
 * - Validates content size, media, name/subject length, variables and usage.
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

    // Validate HTML content size
    if (!ensureHtmlWithinLimit(htmlContent)) {
      return res.status(413).json({
        success: false,
        message: `HTML content exceeds ${EMAIL_JOB_CONFIG.LIMITS.MAX_HTML_BYTES / (1024 * 1024)}MB limit`,
      });
    }

    // Validate HTML does not contain base64-encoded media
    const mediaValidation = validateHtmlMedia(htmlContent);
    if (!mediaValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'HTML contains embedded media files. Only URLs are allowed for media.',
        errors: mediaValidation.errors,
      });
    }

    // Validate name length
    const trimmedName = name.trim();
    if (trimmedName.length > 50) {
      return res.status(400).json({
        success: false,
        message: 'Template name cannot exceed 50 characters',
      });
    }

    // Validate subject length
    const trimmedSubject = subject.trim();
    if (trimmedSubject.length > EMAIL_JOB_CONFIG.LIMITS.SUBJECT_MAX_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Subject cannot exceed ${EMAIL_JOB_CONFIG.LIMITS.SUBJECT_MAX_LENGTH} characters`,
      });
    }

    // Check if template with the same name already exists (case-insensitive)
    const existingTemplate = await EmailTemplate.findOne({
      name: { $regex: new RegExp(`^${trimmedName}$`, 'i') },
    });
    if (existingTemplate) {
      return res.status(400).json({
        success: false,
        message: 'Email template with this name already exists',
      });
    }

    // Validate variables
    if (variables && variables.length > 0) {
      const variableValidation = validateTemplateVariables(variables);
      if (!variableValidation.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Invalid template variables',
          errors: variableValidation.errors,
        });
      }

      // Validate variable usage in content (HTML and subject)
      const variableUsageValidation = validateTemplateVariableUsage(
        variables,
        htmlContent,
        trimmedSubject,
      );
      if (!variableUsageValidation.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Invalid variable usage in template content',
          errors: variableUsageValidation.errors,
        });
      }
    } else {
      // If no variables are defined, check for any variable placeholders in content
      const variablePlaceholderRegex = /\{\{(\w+)\}\}/g;
      const foundInHtml = variablePlaceholderRegex.test(htmlContent);
      variablePlaceholderRegex.lastIndex = 0;
      const foundInSubject = variablePlaceholderRegex.test(trimmedSubject);

      if (foundInHtml || foundInSubject) {
        return res.status(400).json({
          success: false,
          message:
            'Template content contains variable placeholders ({{variableName}}) but no variables are defined. Please define variables or remove placeholders from content.',
        });
      }
    }

    // Validate userId is valid ObjectId
    if (userId && !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      });
    }

    // Create new email template
    const template = new EmailTemplate({
      name: trimmedName,
      subject: trimmedSubject,
      html_content: htmlContent.trim(),
      variables: variables || [],
      created_by: userId,
      updated_by: userId,
    });

    await template.save();

    // Populate created_by and updated_by fields for response
    await template.populate('created_by', 'firstName lastName email');
    await template.populate('updated_by', 'firstName lastName email');

    logger.logInfo(`Email template created: ${template.name} by user ${userId}`);

    res.status(201).json({
      success: true,
      message: 'Email template created successfully',
      template,
    });
  } catch (error) {
    logger.logException(error, 'Error creating email template');
    res.status(500).json({
      success: false,
      message: 'Error creating email template',
      error: error.message,
    });
  }
};

/**
 * Update an existing email template by ID.
 * - Validates content and ensures unique name when changed.
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

    // Validate ObjectId
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid template ID',
      });
    }

    // Validate HTML content size
    if (!ensureHtmlWithinLimit(htmlContent)) {
      return res.status(413).json({
        success: false,
        message: `HTML content exceeds ${EMAIL_JOB_CONFIG.LIMITS.MAX_HTML_BYTES / (1024 * 1024)}MB limit`,
      });
    }

    // Validate HTML does not contain base64-encoded media
    const mediaValidation = validateHtmlMedia(htmlContent);
    if (!mediaValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'HTML contains embedded media files. Only URLs are allowed for media.',
        errors: mediaValidation.errors,
      });
    }

    // Validate name and subject length
    const trimmedName = name.trim();
    const trimmedSubject = subject.trim();

    if (trimmedName.length > 50) {
      return res.status(400).json({
        success: false,
        message: 'Template name cannot exceed 50 characters',
      });
    }

    if (trimmedSubject.length > EMAIL_JOB_CONFIG.LIMITS.SUBJECT_MAX_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Subject cannot exceed ${EMAIL_JOB_CONFIG.LIMITS.SUBJECT_MAX_LENGTH} characters`,
      });
    }

    // Get current template
    const currentTemplate = await EmailTemplate.findById(id);
    if (!currentTemplate) {
      return res.status(404).json({
        success: false,
        message: 'Email template not found',
      });
    }

    // Only check for duplicate names if the name is actually changing (case-insensitive)
    if (currentTemplate.name.toLowerCase() !== trimmedName.toLowerCase()) {
      const existingTemplate = await EmailTemplate.findOne({
        name: { $regex: new RegExp(`^${trimmedName}$`, 'i') },
        _id: { $ne: id },
      });
      if (existingTemplate) {
        return res.status(400).json({
          success: false,
          message: 'Another email template with this name already exists',
        });
      }
    }

    // Validate variables
    if (variables && variables.length > 0) {
      const variableValidation = validateTemplateVariables(variables);
      if (!variableValidation.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Invalid template variables',
          errors: variableValidation.errors,
        });
      }

      // Validate variable usage in content (HTML and subject)
      const variableUsageValidation = validateTemplateVariableUsage(
        variables,
        htmlContent,
        trimmedSubject,
      );
      if (!variableUsageValidation.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Invalid variable usage in template content',
          errors: variableUsageValidation.errors,
        });
      }
    } else {
      // If no variables are defined, check for any variable placeholders in content
      const variablePlaceholderRegex = /\{\{(\w+)\}\}/g;
      const foundInHtml = variablePlaceholderRegex.test(htmlContent);
      variablePlaceholderRegex.lastIndex = 0;
      const foundInSubject = variablePlaceholderRegex.test(trimmedSubject);

      if (foundInHtml || foundInSubject) {
        return res.status(400).json({
          success: false,
          message:
            'Template content contains variable placeholders ({{variableName}}) but no variables are defined. Please define variables or remove placeholders from content.',
        });
      }
    }

    // Validate userId is valid ObjectId
    const userId = req.body.requestor?.requestorId;
    if (userId && !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      });
    }

    // Update template
    const updateData = {
      name: trimmedName,
      subject: trimmedSubject,
      html_content: htmlContent.trim(),
      variables: variables || [],
      updated_by: userId,
    };

    const template = await EmailTemplate.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate('created_by', 'firstName lastName email')
      .populate('updated_by', 'firstName lastName email');

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Email template not found',
      });
    }

    logger.logInfo(`Email template updated: ${template.name} by user ${userId}`);

    res.status(200).json({
      success: true,
      message: 'Email template updated successfully',
      template,
    });
  } catch (error) {
    logger.logException(error, 'Error updating email template');
    res.status(500).json({
      success: false,
      message: 'Error updating email template',
      error: error.message,
    });
  }
};

/**
 * Delete an email template by ID.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const deleteEmailTemplate = async (req, res) => {
  try {
    // Requestor is required for permission check and audit logging
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

    // Validate ObjectId
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid template ID',
      });
    }

    const template = await EmailTemplate.findById(id);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Email template not found',
      });
    }

    await EmailTemplate.findByIdAndDelete(id);

    logger.logInfo(
      `Email template deleted: ${template.name} by user ${req.body.requestor?.requestorId}`,
    );

    res.status(200).json({
      success: true,
      message: 'Email template deleted successfully',
    });
  } catch (error) {
    logger.logException(error, 'Error deleting email template');
    res.status(500).json({
      success: false,
      message: 'Error deleting email template',
      error: error.message,
    });
  }
};

module.exports = {
  getAllEmailTemplates,
  getEmailTemplateById,
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
};
