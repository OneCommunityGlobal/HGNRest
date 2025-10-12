const EmailTemplate = require('../models/EmailTemplateModel');

// Get all email templates
exports.getAllEmailTemplates = async (req, res) => {
  try {
    const { search } = req.query;
    const query = {};

    // Add search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
      ];
    }

    const templates = await EmailTemplate.find(query)
      .populate('created_by', 'firstName lastName')
      .sort({ created_at: -1 });

    res.status(200).json({
      success: true,
      templates,
      count: templates.length,
    });
  } catch (error) {
    console.error('Error fetching email templates:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching email templates.',
      error: error.message,
    });
  }
};

// Get a single email template by ID
exports.getEmailTemplateById = async (req, res) => {
  try {
    const { id } = req.params;
    const template = await EmailTemplate.findById(id).populate('created_by', 'firstName lastName');

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Email template not found.',
      });
    }

    res.status(200).json({
      success: true,
      template,
    });
  } catch (error) {
    console.error('Error fetching email template:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching email template.',
      error: error.message,
    });
  }
};

// Create a new email template
exports.createEmailTemplate = async (req, res) => {
  try {
    const { name, subject, html_content: htmlContent, variables } = req.body;
    const userId = req.body.requestor?.requestorId;

    // Validate required fields
    if (!name || !subject || !htmlContent) {
      return res.status(400).json({
        success: false,
        message: 'Name, subject, and HTML content are required.',
      });
    }

    // Check if template with the same name already exists
    const existingTemplate = await EmailTemplate.findOne({ name });
    if (existingTemplate) {
      return res.status(400).json({
        success: false,
        message: 'Email template with this name already exists.',
      });
    }

    // Validate variables if provided
    if (variables && variables.length > 0) {
      const invalidVariable = variables.find((variable) => !variable.name || !variable.label);
      if (invalidVariable) {
        return res.status(400).json({
          success: false,
          message: 'Variable name and label are required for all variables.',
        });
      }
    }

    // Create new email template
    const template = new EmailTemplate({
      name,
      subject,
      html_content: htmlContent,
      variables: variables || [],
      created_by: userId,
    });

    await template.save();

    // Populate created_by field for response
    await template.populate('created_by', 'firstName lastName');

    res.status(201).json({
      success: true,
      message: 'Email template created successfully.',
      template,
    });
  } catch (error) {
    console.error('Error creating email template:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating email template.',
      error: error.message,
    });
  }
};

// Update an email template
exports.updateEmailTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, subject, html_content: htmlContent, variables } = req.body;

    // Validate required fields
    if (!name || !subject || !htmlContent) {
      return res.status(400).json({
        success: false,
        message: 'Name, subject, and HTML content are required.',
      });
    }

    // Get current template to check if name is actually changing
    const currentTemplate = await EmailTemplate.findById(id);
    if (!currentTemplate) {
      return res.status(404).json({
        success: false,
        message: 'Email template not found.',
      });
    }

    // Only check for duplicate names if the name is actually changing
    if (currentTemplate.name !== name) {
      const existingTemplate = await EmailTemplate.findOne({
        name,
        _id: { $ne: id },
      });
      if (existingTemplate) {
        return res.status(400).json({
          success: false,
          message: 'Another email template with this name already exists.',
        });
      }
    }

    // Validate variables if provided
    if (variables && variables.length > 0) {
      const invalidVariable = variables.find((variable) => !variable.name || !variable.label);
      if (invalidVariable) {
        return res.status(400).json({
          success: false,
          message: 'Variable name and label are required for all variables.',
        });
      }
    }

    // Update template
    const updateData = {
      name,
      subject,
      html_content: htmlContent,
      variables: variables || [],
    };

    const template = await EmailTemplate.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).populate('created_by', 'firstName lastName');

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Email template not found.',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Email template updated successfully.',
      template,
    });
  } catch (error) {
    console.error('Error updating email template:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating email template.',
      error: error.message,
    });
  }
};

// Delete an email template
exports.deleteEmailTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const template = await EmailTemplate.findByIdAndDelete(id);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Email template not found.',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Email template deleted successfully.',
    });
  } catch (error) {
    console.error('Error deleting email template:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting email template.',
      error: error.message,
    });
  }
};

// Send email using template
exports.sendEmailWithTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { recipients, variableValues, broadcastToAll } = req.body;

    // Validate required fields
    if (!broadcastToAll && (!recipients || !Array.isArray(recipients) || recipients.length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'Recipients array is required when not broadcasting to all.',
      });
    }

    // Get template
    const template = await EmailTemplate.findById(id);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Email template not found.',
      });
    }

    // Validate all variables (since all are required by default)
    const missingVariable = template.variables.find(
      (variable) => !variableValues || !variableValues[variable.name],
    );
    if (missingVariable) {
      return res.status(400).json({
        success: false,
        message: `Variable '${missingVariable.label}' is missing.`,
      });
    }

    // Replace variables in subject and content
    let processedSubject = template.subject;
    let processedContent = template.html_content;

    if (variableValues) {
      Object.entries(variableValues).forEach(([varName, varValue]) => {
        const regex = new RegExp(`{{${varName}}}`, 'g');
        processedSubject = processedSubject.replace(regex, varValue);
        processedContent = processedContent.replace(regex, varValue);
      });
    }

    // Import the existing emailSender utility
    const emailSender = require('../utilities/emailSender');

    if (broadcastToAll) {
      // Use existing broadcast functionality
      const { sendEmailToAll } = require('./emailController');

      // Create a mock request object for sendEmailToAll
      const mockReq = {
        body: {
          requestor: req.body.requestor || req.user, // Pass the user making the request
          subject: processedSubject,
          html: processedContent,
        },
      };

      // Create a mock response object to capture the result
      let broadcastResult = null;
      const mockRes = {
        status: (code) => ({
          send: (message) => {
            broadcastResult = { code, message };
          },
        }),
      };

      await sendEmailToAll(mockReq, mockRes);

      if (broadcastResult && broadcastResult.code === 200) {
        res.status(200).json({
          success: true,
          message: 'Email template broadcasted successfully to all users.',
          broadcasted: true,
        });
      } else {
        res.status(broadcastResult?.code || 500).json({
          success: false,
          message: broadcastResult?.message || 'Error broadcasting email template.',
        });
      }
    } else {
      // Send to specific recipients using existing emailSender
      try {
        if (recipients.length === 1) {
          // Single recipient - use TO field
          await emailSender(recipients[0], processedSubject, processedContent);
        } else {
          // Multiple recipients - use BCC to hide recipient list
          const senderEmail = process.env.REACT_APP_EMAIL || 'updates@onecommunityglobal.org';
          await emailSender(
            senderEmail,
            processedSubject,
            processedContent,
            null, // attachments
            null, // cc
            null, // replyTo
            recipients, // bcc
          );
        }

        res.status(200).json({
          success: true,
          message: `Email template sent successfully to ${recipients.length} recipient(s).`,
          sentTo: recipients,
        });
      } catch (emailError) {
        console.error('Error sending emails:', emailError);
        res.status(500).json({
          success: false,
          message: 'Error sending emails.',
          error: emailError.message,
        });
      }
    }
  } catch (error) {
    console.error('Error in sendEmailWithTemplate:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing email template.',
      error: error.message,
    });
  }
};
