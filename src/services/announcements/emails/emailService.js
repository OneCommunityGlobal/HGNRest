const mongoose = require('mongoose');
const Email = require('../../../models/email');
const { EMAIL_JOB_CONFIG } = require('../../../config/emailJobConfig');

class EmailService {
  /**
   * Create a parent Email document for announcements.
   * Trims large text fields and supports optional transaction sessions.
   * @param {{subject: string, htmlContent: string, createdBy: string|ObjectId}} param0
   * @param {import('mongoose').ClientSession|null} session
   * @returns {Promise<Object>} Created Email document.
   */
  static async createEmail({ subject, htmlContent, createdBy }, session = null) {
    const normalizedSubject = typeof subject === 'string' ? subject.trim() : subject;
    const normalizedHtml = typeof htmlContent === 'string' ? htmlContent.trim() : htmlContent;

    const email = new Email({
      subject: normalizedSubject,
      htmlContent: normalizedHtml,
      createdBy,
    });

    // Save with session if provided for transaction support
    await email.save({ session });

    return email;
  }

  /**
   * Fetch a parent Email by ObjectId.
   * @param {string|ObjectId} id
   * @param {import('mongoose').ClientSession|null} session
   * @returns {Promise<Object|null>}
   */
  static async getEmailById(id, session = null) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
    return Email.findById(id).session(session);
  }

  /**
   * Update Email status with validation against configured enum.
   * @param {string|ObjectId} emailId
   * @param {string} status - One of EMAIL_JOB_CONFIG.EMAIL_STATUSES.*
   * @returns {Promise<Object>} Updated Email document.
   */
  static async updateEmailStatus(emailId, status) {
    if (!emailId || !mongoose.Types.ObjectId.isValid(emailId)) {
      throw new Error('Valid email ID is required');
    }
    if (!Object.values(EMAIL_JOB_CONFIG.EMAIL_STATUSES).includes(status)) {
      throw new Error('Invalid email status');
    }
    const email = await Email.findByIdAndUpdate(
      emailId,
      { status, updatedAt: new Date() },
      { new: true },
    );
    return email;
  }

  /**
   * Mark Email as SENDING and set startedAt.
   * @param {string|ObjectId} emailId
   * @returns {Promise<Object>} Updated Email document.
   */
  static async markEmailStarted(emailId) {
    const now = new Date();
    const email = await Email.findByIdAndUpdate(
      emailId,
      {
        status: EMAIL_JOB_CONFIG.EMAIL_STATUSES.SENDING,
        startedAt: now,
        updatedAt: now,
      },
      { new: true },
    );
    return email;
  }

  /**
   * Mark Email as completed with final status, setting completedAt.
   * Falls back to SENT if an invalid finalStatus is passed.
   * @param {string|ObjectId} emailId
   * @param {string} finalStatus
   * @returns {Promise<Object>} Updated Email document.
   */
  static async markEmailCompleted(emailId, finalStatus) {
    const now = new Date();
    const statusToSet = Object.values(EMAIL_JOB_CONFIG.EMAIL_STATUSES).includes(finalStatus)
      ? finalStatus
      : EMAIL_JOB_CONFIG.EMAIL_STATUSES.SENT;

    const email = await Email.findByIdAndUpdate(
      emailId,
      {
        status: statusToSet,
        completedAt: now,
        updatedAt: now,
      },
      { new: true },
    );
    return email;
  }

  /**
   * Mark an Email as QUEUED for retry and clear timing fields.
   * @param {string|ObjectId} emailId
   * @returns {Promise<Object>} Updated Email document.
   */
  static async markEmailQueued(emailId) {
    const now = new Date();
    const email = await Email.findByIdAndUpdate(
      emailId,
      {
        status: EMAIL_JOB_CONFIG.EMAIL_STATUSES.QUEUED,
        startedAt: null,
        completedAt: null,
        updatedAt: now,
      },
      { new: true },
    );
    return email;
  }
}

module.exports = EmailService;
