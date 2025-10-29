/**
 * Email Announcement Service
 * Enhanced email service specifically tuned for announcement use cases
 * Provides better tracking, analytics, and announcement-specific features
 */

const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const logger = require('../startup/logger');

class EmailAnnouncementService {
  constructor() {
    this.config = {
      email: process.env.REACT_APP_EMAIL,
      clientId: process.env.REACT_APP_EMAIL_CLIENT_ID,
      clientSecret: process.env.REACT_APP_EMAIL_CLIENT_SECRET,
      redirectUri: process.env.REACT_APP_EMAIL_CLIENT_REDIRECT_URI,
      refreshToken: process.env.REACT_APP_EMAIL_REFRESH_TOKEN,
      batchSize: 50,
      concurrency: 3,
      rateLimitDelay: 1000,
    };

    this.OAuth2Client = new google.auth.OAuth2(
      this.config.clientId,
      this.config.clientSecret,
      this.config.redirectUri,
    );
    this.OAuth2Client.setCredentials({ refresh_token: this.config.refreshToken });

    // Create the email transporter
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: this.config.email,
        clientId: this.config.clientId,
        clientSecret: this.config.clientSecret,
      },
    });

    this.queue = [];
    this.isProcessing = false;
  }

  /**
   * Normalize email field (convert to array)
   */
  static normalize(field) {
    if (!field) return [];
    if (Array.isArray(field)) return field;
    return String(field).split(',');
  }

  /**
   * Send email with enhanced announcement tracking
   */
  async sendEmail(mailOptions) {
    try {
      const accessTokenResp = await this.OAuth2Client.getAccessToken();
      const token = typeof accessTokenResp === 'object' ? accessTokenResp?.token : accessTokenResp;

      if (!token) {
        throw new Error('NO_OAUTH_ACCESS_TOKEN');
      }

      mailOptions.auth = {
        type: 'OAuth2',
        user: this.config.email,
        clientId: this.config.clientId,
        clientSecret: this.config.clientSecret,
        refreshToken: this.config.refreshToken,
        accessToken: token,
      };

      const result = await this.transporter.sendMail(mailOptions);

      // Enhanced logging for announcements
      if (process.env.NODE_ENV === 'local') {
        logger.logInfo(`Announcement email sent: ${JSON.stringify(result)}`);
      }

      return result;
    } catch (error) {
      console.error('Error sending announcement email:', error);
      logger.logException(error, `Error sending announcement email: ${mailOptions.to}`);

      throw error;
    }
  }

  /**
   * Send email with retry logic and announcement-specific handling
   */
  async sendWithRetry(batch, retries = 3, baseDelay = 1000) {
    /* eslint-disable no-await-in-loop */
    for (let attempt = 1; attempt <= retries; attempt += 1) {
      try {
        const gmailResponse = await this.sendEmail(batch);

        // Store Gmail response for audit logging
        batch.gmailResponse = gmailResponse;
        return true;
      } catch (err) {
        logger.logException(
          err,
          `Announcement batch to ${batch.to || '(empty)'} attempt ${attempt}`,
        );
      }

      if (attempt < retries) {
        await EmailAnnouncementService.sleep(baseDelay * attempt); // Exponential backoff
      }
    }
    /* eslint-enable no-await-in-loop */
    return false;
  }

  /**
   * Process email queue with announcement-specific optimizations
   */
  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      return true;
    }

    this.isProcessing = true;

    try {
      const batches = this.queue.splice(0, this.config.concurrency);
      const promises = batches.map((batch) => this.sendWithRetry(batch));

      await Promise.all(promises);

      if (this.queue.length > 0) {
        await EmailAnnouncementService.sleep(this.config.rateLimitDelay);
        return this.processQueue();
      }

      // Return the last successful Gmail response for audit logging
      const lastBatch = batches[batches.length - 1];
      return lastBatch?.gmailResponse || true;
    } catch (error) {
      logger.logException(error, 'Error processing announcement email queue');
      return false;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Send announcement email with enhanced features
   * @param {string|string[]} recipients - Email recipients
   * @param {string} subject - Email subject
   * @param {string} message - HTML message content
   * @param {Object[]|null} attachments - Email attachments
   * @param {string[]|null} cc - CC recipients
   * @param {string|null} replyTo - Reply-to address
   * @param {string[]|null} emailBccs - BCC recipients
   * @param {Object} opts - Options including announcement-specific metadata
   * @returns {Promise<string>} Processing result
   */
  async sendAnnouncement(
    recipients,
    subject,
    message,
    attachments = null,
    cc = null,
    replyTo = null,
    emailBccs = null,
    opts = {},
  ) {
    const announcementType = opts.announcementType || 'general';
    const priority = opts.priority || 'NORMAL';
    const isUrgent = priority === 'URGENT';
    const isPasswordReset = announcementType === 'password_reset';

    // Check if email sending is enabled
    if (
      !process.env.sendEmail ||
      (String(process.env.sendEmail).toLowerCase() === 'false' && !isPasswordReset)
    ) {
      return Promise.resolve('EMAIL_SENDING_DISABLED');
    }

    return new Promise((resolve, reject) => {
      const recipientsArray = Array.isArray(recipients) ? recipients : [recipients];

      // Enhanced metadata for announcements
      const enhancedMeta = {
        ...opts,
        announcementType,
        priority,
        timestamp: new Date(),
        recipientCount: recipientsArray.length,
        isUrgent,
      };

      // Process recipients in batches
      for (let i = 0; i < recipientsArray.length; i += this.config.batchSize) {
        const batchRecipients = recipientsArray.slice(i, i + this.config.batchSize);

        this.queue.push({
          from: this.config.email,
          to: batchRecipients.length ? batchRecipients.join(',') : '',
          bcc: emailBccs ? emailBccs.join(',') : '',
          subject,
          html: message,
          attachments,
          cc,
          replyTo,
          meta: enhancedMeta,
        });
      }

      // Process queue immediately for urgent announcements
      if (isUrgent) {
        // Move urgent emails to front of queue
        const urgentBatches = this.queue.filter((batch) => batch.meta.isUrgent);
        const normalBatches = this.queue.filter((batch) => !batch.meta.isUrgent);
        this.queue = [...urgentBatches, ...normalBatches];
      }

      setImmediate(async () => {
        try {
          const result = await this.processQueue();
          if (result === false) {
            reject(new Error('Announcement email sending failed after all retries'));
          } else {
            // Return the last successful Gmail response for audit logging
            const lastBatch = this.queue[this.queue.length - 1];
            if (lastBatch && lastBatch.gmailResponse) {
              resolve(lastBatch.gmailResponse);
            } else {
              resolve(result);
            }
          }
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Send announcement summary notification
   */
  async sendAnnouncementSummary(recipientEmail, summary) {
    const summaryHtml = `
      <h2>Announcement Summary</h2>
      <p><strong>Total Recipients:</strong> ${summary.totalRecipients}</p>
      <p><strong>Successfully Sent:</strong> ${summary.sent}</p>
      <p><strong>Failed:</strong> ${summary.failed}</p>
      <p><strong>Success Rate:</strong> ${summary.successRate}%</p>
      <p><strong>Processing Time:</strong> ${summary.processingTime}</p>
      ${summary.errors.length > 0 ? `<h3>Errors:</h3><ul>${summary.errors.map((e) => `<li>${e}</li>`).join('')}</ul>` : ''}
    `;

    return this.sendAnnouncement(
      recipientEmail,
      'Announcement Summary Report',
      summaryHtml,
      null,
      null,
      null,
      null,
      {
        announcementType: 'summary',
        priority: 'LOW',
      },
    );
  }

  /**
   * Sleep utility
   */
  static sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isProcessing: this.isProcessing,
      queueLength: this.queue.length,
      config: {
        batchSize: this.config.batchSize,
        concurrency: this.config.concurrency,
        rateLimitDelay: this.config.rateLimitDelay,
      },
    };
  }
}

// Create singleton instance
const emailAnnouncementService = new EmailAnnouncementService();

module.exports = emailAnnouncementService;
