/**
 * Template Rendering Service - Handles template rendering and variable substitution
 * Provides server-side template rendering with proper sanitization
 */

const sanitizeHtmlLib = require('sanitize-html');

class TemplateRenderingService {
  /**
   * Render template with variable values.
   * Replaces {{variableName}} placeholders with actual values.
   * @param {Object} template - Template object with subject and html_content
   * @param {Object} variables - Object mapping variable names to values
   * @param {Object} options - Rendering options (sanitize, strict)
   * @returns {{subject: string, htmlContent: string}} Rendered template
   */
  static renderTemplate(template, variables = {}, options = {}) {
    const { sanitize = true, strict = false } = options;

    if (!template) {
      const error = new Error('Template is required');
      error.statusCode = 400;
      throw error;
    }

    let subject = template.subject || '';
    let htmlContent = template.html_content || template.htmlContent || '';

    // Get template variables
    const templateVariables = template.variables || [];

    // Replace variables in subject and HTML
    templateVariables.forEach((variable) => {
      if (!variable || !variable.name) return;

      const varName = variable.name;
      const value = variables[varName];

      // In strict mode, throw error if variable is missing
      if (strict && value === undefined) {
        const error = new Error(`Missing required variable: ${varName}`);
        error.statusCode = 400;
        throw error;
      }

      // Skip if value is not provided
      if (value === undefined || value === null) {
        return;
      }

      // Handle image variables
      let processedValue = value;
      if (variable.type === 'image') {
        // Use extracted image if available
        const extractedKey = `${varName}_extracted`;
        if (variables[extractedKey]) {
          processedValue = variables[extractedKey];
        } else if (typeof value === 'string') {
          // Try to extract image URL from value
          const imageMatch =
            value.match(/src=["']([^"']+)["']/i) || value.match(/https?:\/\/[^\s]+/i);
          if (imageMatch) {
            processedValue = imageMatch[1] || imageMatch[0];
          }
        }
      }

      // Replace all occurrences of {{variableName}}
      const regex = new RegExp(`\\{\\{${varName}\\}\\}`, 'g');
      subject = subject.replace(regex, String(processedValue));
      htmlContent = htmlContent.replace(regex, String(processedValue));
    });

    // Sanitize HTML if requested
    if (sanitize) {
      htmlContent = this.sanitizeHtml(htmlContent);
    }

    return {
      subject: subject.trim(),
      htmlContent: htmlContent.trim(),
    };
  }

  /**
   * Validate that all required variables are provided.
   * @param {Object} template - Template object
   * @param {Object} variables - Variable values
   * @returns {{isValid: boolean, errors: string[], missing: string[]}} Validation result
   */
  static validateVariables(template, variables = {}) {
    const errors = [];
    const missing = [];
    const templateVariables = template.variables || [];

    // Check for missing variables
    templateVariables.forEach((variable) => {
      if (!variable || !variable.name) return;

      const varName = variable.name;
      if (
        !(varName in variables) ||
        variables[varName] === undefined ||
        variables[varName] === null
      ) {
        missing.push(varName);
        errors.push(`Missing required variable: ${varName}`);
      }
    });

    // Check for unused variables
    const templateVariableNames = new Set(templateVariables.map((v) => v.name));
    Object.keys(variables).forEach((varName) => {
      if (!templateVariableNames.has(varName) && !varName.endsWith('_extracted')) {
        errors.push(`Unknown variable: ${varName}`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      missing,
    };
  }

  /**
   * Check if template has unreplaced variables.
   * @param {string} content - Content to check (subject or HTML)
   * @returns {string[]} Array of unreplaced variable names
   */
  static getUnreplacedVariables(content) {
    if (!content || typeof content !== 'string') {
      return [];
    }

    const variablePlaceholderRegex = /\{\{(\w+)\}\}/g;
    const unreplaced = [];
    let match = variablePlaceholderRegex.exec(content);

    while (match !== null) {
      const varName = match[1];
      if (!unreplaced.includes(varName)) {
        unreplaced.push(varName);
      }
      match = variablePlaceholderRegex.exec(content);
    }

    return unreplaced;
  }

  /**
   * Sanitize HTML content to prevent XSS attacks.
   * @param {string} html - HTML content to sanitize
   * @param {Object} options - Sanitization options
   * @returns {string} Sanitized HTML
   */
  static sanitizeHtml(html, options = {}) {
    if (!html || typeof html !== 'string') {
      return '';
    }

    const defaultOptions = {
      allowedTags: [
        'p',
        'br',
        'strong',
        'em',
        'b',
        'i',
        'u',
        'a',
        'ul',
        'ol',
        'li',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'div',
        'span',
        'img',
        'table',
        'thead',
        'tbody',
        'tr',
        'td',
        'th',
        'blockquote',
        'hr',
      ],
      allowedAttributes: {
        a: ['href', 'title', 'target', 'rel'],
        img: ['src', 'alt', 'title'],
        '*': ['style', 'class'],
      },
      allowedSchemes: ['http', 'https', 'mailto'],
      allowedSchemesByTag: {
        img: ['http', 'https', 'data'],
      },
      ...options,
    };

    return sanitizeHtmlLib(html, defaultOptions);
  }

  /**
   * Extract variables from template content.
   * @param {Object} template - Template object
   * @returns {string[]} Array of variable names found in content
   */
  static extractVariablesFromContent(template) {
    const variables = new Set();
    const variablePlaceholderRegex = /\{\{(\w+)\}\}/g;

    // Check subject
    if (template.subject) {
      let match = variablePlaceholderRegex.exec(template.subject);
      while (match !== null) {
        variables.add(match[1]);
        match = variablePlaceholderRegex.exec(template.subject);
      }
    }

    // Reset regex
    variablePlaceholderRegex.lastIndex = 0;

    // Check HTML content
    const htmlContent = template.html_content || template.htmlContent || '';
    if (htmlContent) {
      let match = variablePlaceholderRegex.exec(htmlContent);
      while (match !== null) {
        variables.add(match[1]);
        match = variablePlaceholderRegex.exec(htmlContent);
      }
    }

    return Array.from(variables);
  }
}

module.exports = TemplateRenderingService;
