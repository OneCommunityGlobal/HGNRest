/**
 * Email Template Service - Manages EmailTemplate operations
 * Provides business logic for template CRUD operations, validation, and rendering
 */

const mongoose = require('mongoose');
const EmailTemplate = require('../../../models/emailTemplate');
const { EMAIL_CONFIG } = require('../../../config/emailConfig');
const { ensureHtmlWithinLimit } = require('../../../utilities/emailValidators');
const logger = require('../../../startup/logger');

class EmailTemplateService {
  /**
   * Validate template variables.
   * - Ensures non-empty unique names and validates allowed types.
   * @param {Array<{name: string, type?: 'text'|'url'|'number'|'textarea'|'image'>} | undefined} variables
   * @returns {{isValid: boolean, errors?: string[]}}
   */
  static validateTemplateVariables(variables) {
    if (!variables || !Array.isArray(variables)) {
      return { isValid: true, errors: [] };
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
        // Check for duplicates (case-insensitive)
        if (variableNames.has(varName.toLowerCase())) {
          errors.push(`Variable ${index + 1}: duplicate variable name '${varName}'`);
        }
        variableNames.add(varName.toLowerCase());
      }

      if (
        variable.type &&
        !['text', 'url', 'number', 'textarea', 'image'].includes(variable.type)
      ) {
        errors.push(
          `Variable ${index + 1}: type must be one of: text, url, number, textarea, image`,
        );
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
  static validateTemplateVariableUsage(templateVariables, htmlContent, subject) {
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
        errors.push(`Variable '{{${variable.name}}}' is defined but not used in template content`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate template data (name, subject, HTML, variables).
   * @param {Object} templateData - Template data to validate
   * @returns {{isValid: boolean, errors: string[]}}
   */
  static validateTemplateData(templateData) {
    const errors = [];
    const { name, subject, html_content: htmlContent, variables } = templateData;

    // Validate name
    if (!name || typeof name !== 'string' || !name.trim()) {
      errors.push('Template name is required');
    } else {
      const trimmedName = name.trim();
      if (trimmedName.length > EMAIL_CONFIG.LIMITS.TEMPLATE_NAME_MAX_LENGTH) {
        errors.push(
          `Template name cannot exceed ${EMAIL_CONFIG.LIMITS.TEMPLATE_NAME_MAX_LENGTH} characters`,
        );
      }
    }

    // Validate subject
    if (!subject || typeof subject !== 'string' || !subject.trim()) {
      errors.push('Template subject is required');
    } else {
      const trimmedSubject = subject.trim();
      if (trimmedSubject.length > EMAIL_CONFIG.LIMITS.SUBJECT_MAX_LENGTH) {
        errors.push(`Subject cannot exceed ${EMAIL_CONFIG.LIMITS.SUBJECT_MAX_LENGTH} characters`);
      }
    }

    // Validate HTML content
    if (!htmlContent || typeof htmlContent !== 'string' || !htmlContent.trim()) {
      errors.push('Template HTML content is required');
    } else if (!ensureHtmlWithinLimit(htmlContent)) {
      errors.push(
        `HTML content exceeds ${EMAIL_CONFIG.LIMITS.MAX_HTML_BYTES / (1024 * 1024)}MB limit`,
      );
    }

    // Validate variables
    if (variables && variables.length > 0) {
      const variableValidation = this.validateTemplateVariables(variables);
      if (!variableValidation.isValid) {
        errors.push(...variableValidation.errors);
      }

      // Validate variable usage in content
      const variableUsageValidation = this.validateTemplateVariableUsage(
        variables,
        htmlContent,
        subject,
      );
      if (!variableUsageValidation.isValid) {
        errors.push(...variableUsageValidation.errors);
      }
    } else {
      // If no variables are defined, check for any variable placeholders in content
      const variablePlaceholderRegex = /\{\{(\w+)\}\}/g;
      const foundInHtml = variablePlaceholderRegex.test(htmlContent);
      variablePlaceholderRegex.lastIndex = 0;
      const foundInSubject = variablePlaceholderRegex.test(subject);

      if (foundInHtml || foundInSubject) {
        errors.push(
          'Template content contains variable placeholders ({{variableName}}) but no variables are defined. Please define variables or remove placeholders from content.',
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Create a new email template.
   * @param {Object} templateData - Template data
   * @param {string|ObjectId} userId - User ID creating the template
   * @returns {Promise<Object>} Created template
   * @throws {Error} If validation fails or template already exists
   */
  static async createTemplate(templateData, userId) {
    const { name, subject, html_content: htmlContent, variables } = templateData;

    // Validate template data
    const validation = this.validateTemplateData(templateData);
    if (!validation.isValid) {
      const error = new Error('Invalid template data');
      error.errors = validation.errors;
      error.statusCode = 400;
      throw error;
    }

    // Validate userId
    if (userId && !mongoose.Types.ObjectId.isValid(userId)) {
      const error = new Error('Invalid user ID');
      error.statusCode = 400;
      throw error;
    }

    const trimmedName = name.trim();
    const trimmedSubject = subject.trim();

    // Check if template with the same name already exists (case-insensitive)
    const existingTemplate = await EmailTemplate.findOne({
      name: { $regex: new RegExp(`^${trimmedName}$`, 'i') },
    });

    if (existingTemplate) {
      const error = new Error('Email template with this name already exists');
      error.statusCode = 409;
      throw error;
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
    try {
      await template.save();
    } catch (dbError) {
      // Handle MongoDB errors
      if (dbError.name === 'ValidationError') {
        const error = new Error(`Validation error: ${dbError.message}`);
        error.statusCode = 400;
        throw error;
      }
      if (dbError.code === 11000) {
        const error = new Error('Email template with this name already exists');
        error.statusCode = 409;
        throw error;
      }
      // Re-throw with status code for other database errors
      dbError.statusCode = 500;
      throw dbError;
    }

    // Populate created_by and updated_by fields
    await template.populate('created_by', 'firstName lastName email');
    await template.populate('updated_by', 'firstName lastName email');

    logger.logInfo(`Email template created: ${template.name} by user ${userId}`);

    return template;
  }

  /**
   * Get template by ID.
   * @param {string|ObjectId} id - Template ID
   * @param {Object} options - Query options (populate)
   * @returns {Promise<Object>} Template
   * @throws {Error} If template not found or invalid ID
   */
  static async getTemplateById(id, options = {}) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      const error = new Error('Invalid template ID');
      error.statusCode = 400;
      throw error;
    }

    const { populate = true } = options;

    let template = EmailTemplate.findById(id);

    if (populate) {
      template = template
        .populate('created_by', 'firstName lastName email')
        .populate('updated_by', 'firstName lastName email');
    }

    const result = await template;
    if (!result) {
      const error = new Error('Email template not found');
      error.statusCode = 404;
      throw error;
    }

    return result;
  }

  /**
   * Get all templates with optional filtering and sorting.
   * @param {Object} query - MongoDB query
   * @param {Object} options - Query options (sort, projection, populate)
   * @returns {Promise<Array>} Array of templates
   */
  static async getAllTemplates(query = {}, options = {}) {
    const { sort = { created_at: -1 }, projection = null, populate = true } = options;

    let queryBuilder = EmailTemplate.find(query);

    if (projection) {
      queryBuilder = queryBuilder.select(projection);
    }

    if (sort) {
      queryBuilder = queryBuilder.sort(sort);
    }

    if (populate) {
      queryBuilder = queryBuilder
        .populate('created_by', 'firstName lastName')
        .populate('updated_by', 'firstName lastName');
    }

    return queryBuilder.lean();
  }

  /**
   * Update an existing template.
   * @param {string|ObjectId} id - Template ID
   * @param {Object} templateData - Updated template data
   * @param {string|ObjectId} userId - User ID updating the template
   * @returns {Promise<Object>} Updated template
   * @throws {Error} If validation fails or template not found
   */
  static async updateTemplate(id, templateData, userId) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      const error = new Error('Invalid template ID');
      error.statusCode = 400;
      throw error;
    }

    // Validate template data
    const validation = this.validateTemplateData(templateData);
    if (!validation.isValid) {
      const error = new Error('Invalid template data');
      error.errors = validation.errors;
      error.statusCode = 400;
      throw error;
    }

    // Validate userId
    if (userId && !mongoose.Types.ObjectId.isValid(userId)) {
      const error = new Error('Invalid user ID');
      error.statusCode = 400;
      throw error;
    }

    // Get current template
    const currentTemplate = await EmailTemplate.findById(id);

    if (!currentTemplate) {
      const error = new Error('Email template not found');
      error.statusCode = 404;
      throw error;
    }

    const { name, subject, html_content: htmlContent, variables } = templateData;
    const trimmedName = name.trim();
    const trimmedSubject = subject.trim();

    // Only check for duplicate names if the name is actually changing (case-insensitive)
    if (currentTemplate.name.toLowerCase() !== trimmedName.toLowerCase()) {
      const existingTemplate = await EmailTemplate.findOne({
        name: { $regex: new RegExp(`^${trimmedName}$`, 'i') },
        _id: { $ne: id },
      });

      if (existingTemplate) {
        const error = new Error('Another email template with this name already exists');
        error.statusCode = 409;
        throw error;
      }
    }

    // Update template
    const updateData = {
      name: trimmedName,
      subject: trimmedSubject,
      html_content: htmlContent.trim(),
      variables: variables || [],
      updated_by: userId,
    };

    let template;
    try {
      template = await EmailTemplate.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
      })
        .populate('created_by', 'firstName lastName email')
        .populate('updated_by', 'firstName lastName email');
    } catch (dbError) {
      // Handle MongoDB errors
      if (dbError.name === 'ValidationError') {
        const error = new Error(`Validation error: ${dbError.message}`);
        error.statusCode = 400;
        throw error;
      }
      if (dbError.code === 11000) {
        const error = new Error('Another email template with this name already exists');
        error.statusCode = 409;
        throw error;
      }
      // Re-throw with status code for other database errors
      dbError.statusCode = 500;
      throw dbError;
    }

    if (!template) {
      const error = new Error('Email template not found');
      error.statusCode = 404;
      throw error;
    }

    logger.logInfo(`Email template updated: ${template.name} by user ${userId}`);

    return template;
  }

  /**
   * Delete a template (hard delete).
   * @param {string|ObjectId} id - Template ID
   * @param {string|ObjectId} userId - User ID deleting the template
   * @returns {Promise<Object>} Deleted template
   * @throws {Error} If template not found
   */
  static async deleteTemplate(id, userId) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      const error = new Error('Invalid template ID');
      error.statusCode = 400;
      throw error;
    }

    const template = await EmailTemplate.findById(id);

    if (!template) {
      const error = new Error('Email template not found');
      error.statusCode = 404;
      throw error;
    }

    const templateName = template.name;

    // Hard delete
    await EmailTemplate.findByIdAndDelete(id);

    logger.logInfo(`Email template deleted: ${templateName} by user ${userId}`);

    return template;
  }

  /**
   * Check if template name exists (case-insensitive).
   * @param {string} name - Template name
   * @param {string|ObjectId} excludeId - Template ID to exclude from check
   * @returns {Promise<boolean>} True if name exists
   */
  static async templateNameExists(name, excludeId = null) {
    const query = {
      name: { $regex: new RegExp(`^${name}$`, 'i') },
    };

    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const existing = await EmailTemplate.findOne(query);
    return !!existing;
  }
}

module.exports = EmailTemplateService;
