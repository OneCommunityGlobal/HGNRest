/**
 * Email Announcement Service
 * Handles sending emails via Gmail API using OAuth2 authentication
 * Provides validation, retry logic, and comprehensive error handling
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
    };

    // Validate configuration
    const required = ['email', 'clientId', 'clientSecret', 'refreshToken', 'redirectUri'];
    const missing = required.filter((k) => !this.config[k]);
    if (missing.length) {
      throw new Error(`Email config incomplete. Missing: ${missing.join(', ')}`);
    }

    this.OAuth2Client = new google.auth.OAuth2(
      this.config.clientId,
      this.config.clientSecret,
      this.config.redirectUri,
    );
    this.OAuth2Client.setCredentials({ refresh_token: this.config.refreshToken });

    // Create the email transporter
    try {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: this.config.email,
          clientId: this.config.clientId,
          clientSecret: this.config.clientSecret,
        },
      });
    } catch (error) {
      logger.logException(error, 'EmailAnnouncementService: Failed to create transporter');
      throw error;
    }
  }

  /**
   * Send email with enhanced announcement tracking
   * Validates input and configuration before sending
   * @returns {Object} { success: boolean, response?: Object, error?: Error }
   */
  async sendEmail(mailOptions) {
    // Validation
    if (!mailOptions) {
      const error = new Error('INVALID_MAIL_OPTIONS: mailOptions is required');
      logger.logException(error, 'EmailAnnouncementService.sendEmail validation failed');
      return { success: false, error };
    }

    if (!mailOptions.to && !mailOptions.bcc) {
      const error = new Error('INVALID_RECIPIENTS: At least one recipient (to or bcc) is required');
      logger.logException(error, 'EmailAnnouncementService.sendEmail validation failed');
      return { success: false, error };
    }

    // Validate subject and htmlContent
    if (!mailOptions.subject || mailOptions.subject.trim() === '') {
      const error = new Error('INVALID_SUBJECT: Subject is required and cannot be empty');
      logger.logException(error, 'EmailAnnouncementService.sendEmail validation failed');
      return { success: false, error };
    }

    if (!this.config.email || !this.config.clientId || !this.config.clientSecret) {
      const error = new Error('INVALID_CONFIG: Email configuration is incomplete');
      logger.logException(error, 'EmailAnnouncementService.sendEmail configuration check failed');
      return { success: false, error };
    }

    try {
      // Get access token with proper error handling
      let token;
      try {
        const accessTokenResp = await this.OAuth2Client.getAccessToken();
        if (accessTokenResp && typeof accessTokenResp === 'object' && accessTokenResp.token) {
          token = accessTokenResp.token;
        } else if (typeof accessTokenResp === 'string') {
          token = accessTokenResp;
        } else {
          throw new Error('Invalid access token response format');
        }
      } catch (tokenError) {
        const error = new Error(`OAUTH_TOKEN_ERROR: ${tokenError.message}`);
        logger.logException(error, 'EmailAnnouncementService.sendEmail OAuth token refresh failed');
        return { success: false, error };
      }

      if (!token) {
        const error = new Error('NO_OAUTH_ACCESS_TOKEN: Failed to obtain access token');
        logger.logException(error, 'EmailAnnouncementService.sendEmail OAuth failed');
        return { success: false, error };
      }

      // Configure OAuth2
      mailOptions.auth = {
        type: 'OAuth2',
        user: this.config.email,
        clientId: this.config.clientId,
        clientSecret: this.config.clientSecret,
        refreshToken: this.config.refreshToken,
        accessToken: token,
      };

      // Send email
      const result = await this.transporter.sendMail(mailOptions);

      // Enhanced logging for announcements
      logger.logInfo(
        `Announcement email sent to: ${mailOptions.to || mailOptions.bcc || 'unknown'}`,
        result,
      );

      return { success: true, response: result };
    } catch (error) {
      logger.logException(
        error,
        `Error sending announcement email to: ${mailOptions.to || mailOptions.bcc || 'unknown'}`,
      );
      return { success: false, error };
    }
  }

  /**
   * Send email with retry logic and announcement-specific handling
   * @param {Object} batch - Mail options batch
   * @param {number} retries - Number of retry attempts
   * @param {number} baseDelay - Base delay in milliseconds for exponential backoff
   * @returns {Promise<Object>} { success: boolean, response?: Object, error?: Error, attemptCount: number }
   */
  async sendWithRetry(batch, retries = 3, baseDelay = 1000) {
    // Validation
    if (!batch) {
      const error = new Error('INVALID_BATCH: batch is required');
      logger.logException(error, 'EmailAnnouncementService.sendWithRetry validation failed');
      return { success: false, error, attemptCount: 0 };
    }

    if (!Number.isInteger(retries) || retries < 1) {
      const error = new Error('INVALID_RETRIES: retries must be a positive integer');
      logger.logException(error, 'EmailAnnouncementService.sendWithRetry validation failed');
      return { success: false, error, attemptCount: 0 };
    }

    let attemptCount = 0;

    /* eslint-disable no-await-in-loop */
    for (let attempt = 1; attempt <= retries; attempt += 1) {
      attemptCount += 1;

      try {
        const result = await this.sendEmail(batch);

        if (result.success) {
          // Store Gmail response for audit logging
          batch.gmailResponse = result.response;
          logger.logInfo(
            `Email sent successfully on attempt ${attempt} to: ${batch.to || batch.bcc || 'unknown'}`,
          );
          return { success: true, response: result.response, attemptCount };
        }
        // result.success is false - log and try again or return
        const error = result.error || new Error('Unknown error from sendEmail');
        logger.logException(
          error,
          `Announcement batch attempt ${attempt} failed to: ${batch.to || batch.bcc || '(empty)'}`,
        );

        // If this is the last attempt, return failure info
        if (attempt >= retries) {
          return { success: false, error, attemptCount };
        }
      } catch (err) {
        // Unexpected error (shouldn't happen since sendEmail now returns {success, error})
        logger.logException(
          err,
          `Unexpected error in announcement batch attempt ${attempt} to: ${batch.to || batch.bcc || '(empty)'}`,
        );

        // If this is the last attempt, return failure info
        if (attempt >= retries) {
          return { success: false, error: err, attemptCount };
        }
      }

      // Exponential backoff before retry (2^n: 1x, 2x, 4x, 8x, ...)
      if (attempt < retries) {
        const delay = baseDelay * 2 ** (attempt - 1);
        await EmailAnnouncementService.sleep(delay);
      }
    }
    /* eslint-enable no-await-in-loop */

    return {
      success: false,
      error: new Error('MAX_RETRIES_EXCEEDED: All retry attempts failed'),
      attemptCount,
    };
  }

  /**
   * Sleep utility
   */
  static sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}

// Create singleton instance
const emailAnnouncementService = new EmailAnnouncementService();

module.exports = emailAnnouncementService;
