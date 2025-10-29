const EmailTemplate = require('../models/EmailTemplateModel');

// Get all email templates with pagination and optimization
exports.getAllEmailTemplates = async (req, res) => {
  try {
    const { search, page, limit, sortBy, sortOrder, fields, includeVariables } = req.query;

    const query = {};
    const sort = {};

    // Parse pagination parameters - let frontend decide defaults
    const pageNum = page ? Math.max(1, parseInt(page, 10)) : 1;
    const limitNum = limit ? parseInt(limit, 10) : null; // No restrictions, let frontend decide
    const skip = limitNum && pageNum ? (pageNum - 1) * limitNum : 0;

    // Add search functionality with text index
    if (search && search.trim()) {
      query.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { subject: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    // No filtering - removed variable filtering as requested

    // Build sort object - let frontend decide sort field and order
    if (sortBy) {
      const sortDirection = sortOrder === 'desc' ? -1 : 1;
      sort[sortBy] = sortDirection;
    } else {
      // Default sort only if frontend doesn't specify
      sort.created_at = -1;
    }

    // Execute optimized query with pagination
    let queryBuilder = EmailTemplate.find(query);

    // Let components decide which fields to include
    if (fields) {
      // Parse comma-separated fields and always include _id
      const fieldList = fields.split(',').map((field) => field.trim());
      if (!fieldList.includes('_id')) {
        fieldList.unshift('_id');
      }
      queryBuilder = queryBuilder.select(fieldList.join(' '));
    } else if (includeVariables === 'true') {
      // Include all fields including variables if requested
      // Don't use select('') as it excludes all fields, use no select() to include all
    } else {
      // Default minimal fields for list view
      queryBuilder = queryBuilder.select('_id name created_at updated_at created_by updated_by');
    }

    // Populate user fields if they're in the selection
    if (includeVariables === 'true' || !fields || fields.includes('created_by')) {
      queryBuilder = queryBuilder.populate('created_by', 'firstName lastName');
    }
    if (includeVariables === 'true' || !fields || fields.includes('updated_by')) {
      queryBuilder = queryBuilder.populate('updated_by', 'firstName lastName');
    }

    queryBuilder = queryBuilder.sort(sort).skip(skip);

    // Only apply limit if specified
    if (limitNum) {
      queryBuilder = queryBuilder.limit(limitNum);
    }

    const [templates, totalCount] = await Promise.all([
      queryBuilder.lean(), // Use lean() for better performance
      EmailTemplate.countDocuments(query),
    ]);

    // Transform templates based on what components requested
    let processedTemplates;
    if (includeVariables === 'true') {
      // Return full template data including variables
      processedTemplates = templates.map((template) => ({
        _id: template._id,
        name: template.name,
        subject: template.subject,
        content: template.content,
        variables: template.variables || [],
        created_by: template.created_by,
        updated_by: template.updated_by,
        created_at: template.created_at,
        updated_at: template.updated_at,
      }));
    } else if (fields) {
      // Return only requested fields
      processedTemplates = templates.map((template) => {
        const fieldList = fields.split(',').map((field) => field.trim());
        const result = { _id: template._id };
        fieldList.forEach((field) => {
          if (template[field] !== undefined) {
            result[field] = template[field];
          }
        });
        return result;
      });
    } else {
      // Default minimal fields for list view
      processedTemplates = templates.map((template) => ({
        _id: template._id,
        name: template.name,
        created_by: template.created_by,
        updated_by: template.updated_by,
        created_at: template.created_at,
        updated_at: template.updated_at,
      }));
    }

    // Calculate pagination info
    const totalPages = limitNum ? Math.ceil(totalCount / limitNum) : 1;
    const hasNextPage = limitNum ? pageNum < totalPages : false;
    const hasPrevPage = pageNum > 1;

    res.status(200).json({
      success: true,
      templates: processedTemplates,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        limit: limitNum,
        hasNextPage,
        hasPrevPage,
      },
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
    const template = await EmailTemplate.findById(id)
      .populate('created_by', 'firstName lastName')
      .populate('updated_by', 'firstName lastName');

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
      updated_by: userId, // Set updated_by to same as created_by for new templates
    });

    await template.save();

    // Populate created_by and updated_by fields for response
    await template.populate('created_by', 'firstName lastName');
    await template.populate('updated_by', 'firstName lastName');

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
      updated_by: req.body.requestor?.requestorId, // Set who updated the template
    };

    const template = await EmailTemplate.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate('created_by', 'firstName lastName')
      .populate('updated_by', 'firstName lastName');

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
      // Send to specific recipients using batch system
      try {
        const EmailBatchService = require('../services/emailBatchService');
        const userProfile = require('../models/userProfile');

        // Get user information
        const user = await userProfile.findById(req.body.requestor.requestorId);
        if (!user) {
          return res.status(400).json({
            success: false,
            message: 'User not found',
          });
        }

        // Create batch for template email (this already adds recipients internally)
        console.log('📧 Creating batch for template email...');
        const batch = await EmailBatchService.createSingleSendBatch(
          {
            to: recipients,
            subject: processedSubject,
            html: processedContent,
            attachments: null,
          },
          user,
        );

        console.log('✅ Template batch created with recipients:', batch.batchId);
        console.log('📊 Batch details:', {
          id: batch._id,
          batchId: batch.batchId,
          status: batch.status,
          createdBy: batch.createdBy,
        });

        // REMOVED: Immediate processing - batch will be processed by cron job
        // emailBatchProcessor.processBatch(batch.batchId).catch((error) => {
        //   console.error('❌ Error processing template batch:', error);
        // });

        // Get dynamic counts for response
        const counts = await batch.getEmailCounts();

        res.status(200).json({
          success: true,
          message: `Email template batch created successfully for ${recipients.length} recipient(s).`,
          data: {
            batchId: batch.batchId,
            status: batch.status,
            subject: batch.subject,
            recipients,
            ...counts,
            template: {
              id: template._id,
              name: template.name,
              subject: template.subject,
            },
            createdBy: batch.createdBy,
            createdAt: batch.createdAt,
            estimatedCompletion: new Date(Date.now() + recipients.length * 2000), // 2 seconds per email estimate
          },
        });
      } catch (emailError) {
        console.error('Error creating template batch:', emailError);
        res.status(500).json({
          success: false,
          message: 'Error creating template batch.',
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
