const mongoose = require('mongoose');
const Email = require('../models/email');
const { EMAIL_JOB_CONFIG } = require('../config/emailJobConfig');

class EmailService {
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

  static async getEmailById(id, session = null) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
    return Email.findById(id).session(session);
  }

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
   * Mark an Email as QUEUED for retry (e.g., after resetting failed EmailBatch items)
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
