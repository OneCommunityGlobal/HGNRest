const mongoose = require('mongoose');
const Email = require('../../../models/email');
const EmailBatch = require('../../../models/emailBatch');
const { EMAIL_CONFIG } = require('../../../config/emailConfig');
const { ensureHtmlWithinLimit } = require('../../../utilities/emailValidators');

class EmailService {
  /**
   * Create a parent Email document for announcements.
   * Validates and trims large text fields and supports optional transaction sessions.
   * @param {{subject: string, htmlContent: string, createdBy: string|ObjectId}} param0
   * @param {import('mongoose').ClientSession|null} session
   * @returns {Promise<Object>} Created Email document.
   * @throws {Error} If validation fails
   */
  static async createEmail({ subject, htmlContent, createdBy }, session = null) {
    // Validate required fields
    if (!subject || typeof subject !== 'string' || !subject.trim()) {
      const error = new Error('Subject is required');
      error.statusCode = 400;
      throw error;
    }

    if (!htmlContent || typeof htmlContent !== 'string' || !htmlContent.trim()) {
      const error = new Error('HTML content is required');
      error.statusCode = 400;
      throw error;
    }

    if (!createdBy || !mongoose.Types.ObjectId.isValid(createdBy)) {
      const error = new Error('Valid createdBy is required');
      error.statusCode = 400;
      throw error;
    }

    // Validate subject length
    const trimmedSubject = subject.trim();
    if (trimmedSubject.length > EMAIL_CONFIG.LIMITS.SUBJECT_MAX_LENGTH) {
      const error = new Error(
        `Subject cannot exceed ${EMAIL_CONFIG.LIMITS.SUBJECT_MAX_LENGTH} characters`,
      );
      error.statusCode = 400;
      throw error;
    }

    // Validate HTML content size
    if (!ensureHtmlWithinLimit(htmlContent)) {
      const error = new Error(
        `HTML content exceeds ${EMAIL_CONFIG.LIMITS.MAX_HTML_BYTES / (1024 * 1024)}MB limit`,
      );
      error.statusCode = 413;
      throw error;
    }

    const normalizedHtml = htmlContent.trim();

    const emailData = {
      subject: trimmedSubject,
      htmlContent: normalizedHtml,
      createdBy,
    };

    const email = new Email(emailData);

    // Save with session if provided for transaction support
    try {
      await email.save({ session });
    } catch (dbError) {
      // Handle MongoDB errors
      if (dbError.name === 'ValidationError') {
        const error = new Error(`Validation error: ${dbError.message}`);
        error.statusCode = 400;
        throw error;
      }
      if (dbError.code === 11000) {
        const error = new Error('Duplicate key error');
        error.statusCode = 409;
        throw error;
      }
      // Re-throw with status code for other database errors
      dbError.statusCode = 500;
      throw dbError;
    }

    return email;
  }

  /**
   * Fetch a parent Email by ObjectId.
   * @param {string|ObjectId} id
   * @param {import('mongoose').ClientSession|null} session
   * @param {boolean} throwIfNotFound - If true, throw error with statusCode 404 if not found. Default: false (returns null).
   * @param {boolean} populateCreatedBy - If true, populate createdBy field. Default: false.
   * @returns {Promise<Object|null>}
   * @throws {Error} If throwIfNotFound is true and email is not found
   */
  static async getEmailById(
    id,
    session = null,
    throwIfNotFound = false,
    populateCreatedBy = false,
  ) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      if (throwIfNotFound) {
        const error = new Error('Valid email ID is required');
        error.statusCode = 400;
        throw error;
      }
      return null;
    }
    let query = Email.findById(id);
    if (session) {
      query = query.session(session);
    }
    if (populateCreatedBy) {
      query = query.populate('createdBy', 'firstName lastName email');
    }
    const email = await query;
    if (!email && throwIfNotFound) {
      const error = new Error(`Email ${id} not found`);
      error.statusCode = 404;
      throw error;
    }
    return email;
  }

  /**
   * Update Email status with validation against configured enum.
   * @param {string|ObjectId} emailId
   * @param {string} status - One of EMAIL_CONFIG.EMAIL_STATUSES.*
   * @returns {Promise<Object>} Updated Email document.
   * @throws {Error} If email not found or invalid status
   */
  static async updateEmailStatus(emailId, status) {
    if (!emailId || !mongoose.Types.ObjectId.isValid(emailId)) {
      const error = new Error('Valid email ID is required');
      error.statusCode = 400;
      throw error;
    }
    if (!Object.values(EMAIL_CONFIG.EMAIL_STATUSES).includes(status)) {
      const error = new Error('Invalid email status');
      error.statusCode = 400;
      throw error;
    }
    const email = await Email.findByIdAndUpdate(
      emailId,
      { status, updatedAt: new Date() },
      { new: true },
    );
    if (!email) {
      const error = new Error(`Email ${emailId} not found`);
      error.statusCode = 404;
      throw error;
    }
    return email;
  }

  /**
   * Mark Email as SENDING and set startedAt.
   * Uses atomic update with condition to prevent race conditions.
   * @param {string|ObjectId} emailId
   * @returns {Promise<Object>} Updated Email document.
   * @throws {Error} If email not found or not in PENDING status
   */
  static async markEmailStarted(emailId) {
    const now = new Date();
    const email = await Email.findOneAndUpdate(
      {
        _id: emailId,
        status: EMAIL_CONFIG.EMAIL_STATUSES.PENDING,
      },
      {
        status: EMAIL_CONFIG.EMAIL_STATUSES.SENDING,
        startedAt: now,
        updatedAt: now,
      },
      { new: true },
    );

    if (!email) {
      const error = new Error(`Email ${emailId} not found or not in PENDING status`);
      error.statusCode = 404;
      throw error;
    }

    return email;
  }

  /**
   * Mark Email as completed with final status, setting completedAt.
   * Falls back to SENT if an invalid finalStatus is passed.
   * @param {string|ObjectId} emailId
   * @param {string} finalStatus
   * @returns {Promise<Object>} Updated Email document.
   * @throws {Error} If email not found
   */
  static async markEmailCompleted(emailId, finalStatus) {
    const now = new Date();
    const statusToSet = Object.values(EMAIL_CONFIG.EMAIL_STATUSES).includes(finalStatus)
      ? finalStatus
      : EMAIL_CONFIG.EMAIL_STATUSES.SENT;

    const email = await Email.findByIdAndUpdate(
      emailId,
      {
        status: statusToSet,
        completedAt: now,
        updatedAt: now,
      },
      { new: true },
    );
    if (!email) {
      const error = new Error(`Email ${emailId} not found`);
      error.statusCode = 404;
      throw error;
    }
    return email;
  }

  /**
   * Mark an Email as PENDING for retry and clear timing fields.
   * @param {string|ObjectId} emailId
   * @returns {Promise<Object>} Updated Email document.
   * @throws {Error} If email not found
   */
  static async markEmailPending(emailId) {
    const now = new Date();
    const email = await Email.findByIdAndUpdate(
      emailId,
      {
        status: EMAIL_CONFIG.EMAIL_STATUSES.PENDING,
        startedAt: null,
        completedAt: null,
        updatedAt: now,
      },
      { new: true },
    );
    if (!email) {
      const error = new Error(`Email ${emailId} not found`);
      error.statusCode = 404;
      throw error;
    }
    return email;
  }

  /**
   * Get all Emails ordered by creation date descending.
   * Includes aggregated recipient counts from EmailBatch items.
   * @returns {Promise<Array>} Array of Email objects (lean, with createdBy populated and recipient counts).
   */
  static async getAllEmails() {
    const emails = await Email.find()
      .sort({ createdAt: -1 })
      .populate('createdBy', 'firstName lastName email')
      .lean();

    // Aggregate recipient counts and batch counts from EmailBatch for each email
    const emailsWithCounts = await Promise.all(
      emails.map(async (email) => {
        // Get total recipients count (sum of all recipients across all batches)
        const totalRecipientsAggregation = await EmailBatch.aggregate([
          { $match: { emailId: email._id } },
          {
            $group: {
              _id: null,
              totalRecipients: {
                $sum: { $size: { $ifNull: ['$recipients', []] } },
              },
            },
          },
        ]);

        // Count batches by status (for sentEmails and failedEmails)
        const batchCountsByStatus = await EmailBatch.aggregate([
          { $match: { emailId: email._id } },
          {
            $group: {
              _id: '$status',
              batchCount: { $sum: 1 },
            },
          },
        ]);

        // Calculate totals
        const totalEmails =
          totalRecipientsAggregation.length > 0
            ? totalRecipientsAggregation[0].totalRecipients || 0
            : 0;

        let sentEmails = 0; // Batch count
        let failedEmails = 0; // Batch count

        batchCountsByStatus.forEach((result) => {
          if (result._id === EMAIL_CONFIG.EMAIL_BATCH_STATUSES.SENT) {
            sentEmails = result.batchCount || 0;
          } else if (result._id === EMAIL_CONFIG.EMAIL_BATCH_STATUSES.FAILED) {
            failedEmails = result.batchCount || 0;
          }
        });

        return {
          ...email,
          totalEmails, // Total recipients
          sentEmails, // Count of SENT batches
          failedEmails, // Count of FAILED batches
        };
      }),
    );

    return emailsWithCounts;
  }

  /**
   * Get all PENDING emails that need to be processed.
   * @returns {Promise<Array>} Array of Email objects with PENDING status.
   */
  static async getPendingEmails() {
    return Email.find({
      status: EMAIL_CONFIG.EMAIL_STATUSES.PENDING,
    })
      .sort({ createdAt: 1 }) // Process oldest first
      .lean();
  }

  /**
   * Get all STUCK emails (SENDING status).
   * On server restart, any email in SENDING status is considered stuck because
   * the processing was interrupted. We reset ALL SENDING emails because the
   * server restart means they're no longer being processed.
   * @returns {Promise<Array>} Array of Email objects with SENDING status that are stuck.
   */
  static async getStuckEmails() {
    // On server restart: Reset ALL emails in SENDING status (they're all stuck)
    return Email.find({
      status: EMAIL_CONFIG.EMAIL_STATUSES.SENDING,
    })
      .sort({ startedAt: 1 }) // Process oldest first
      .lean();
  }

  /**
   * Reset stuck email to PENDING status so it can be reprocessed.
   * @param {string|ObjectId} emailId
   * @returns {Promise<Object>} Updated Email document.
   * @throws {Error} If email not found
   */
  static async resetStuckEmail(emailId) {
    const now = new Date();
    const email = await Email.findByIdAndUpdate(
      emailId,
      {
        status: EMAIL_CONFIG.EMAIL_STATUSES.PENDING,
        startedAt: null, // Clear startedAt so it can be reprocessed
        updatedAt: now,
      },
      { new: true },
    );
    if (!email) {
      const error = new Error(`Email ${emailId} not found`);
      error.statusCode = 404;
      throw error;
    }
    return email;
  }
}

module.exports = EmailService;
