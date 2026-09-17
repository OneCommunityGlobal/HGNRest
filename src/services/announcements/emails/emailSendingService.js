/**
 * Email Sending Service
 * Handles sending emails via Gmail API using OAuth2 authentication
 * Provides validation, retry logic, and comprehensive error handling
 */

const nodemailer = require('nodemailer');
const { google } = require('googleapis');
// const logger = require('../../../startup/logger');

class EmailSendingService {
  /**
   * Initialize Gmail OAuth2 transport configuration and validate required env vars.
   * Uses lazy initialization - only initializes when first used (not at module load).
   * Throws during initialization if configuration is incomplete to fail fast.
   */
  constructor() {
    this._initialized = false;
    this.config = null;
    this.OAuth2Client = null;
    this.transporter = null;
  }

  /**
   * Initialize the service if not already initialized.
   * Lazy initialization allows tests to run without email config.
   * @private
   */
  _initialize() {
    if (this._initialized) {
      return;
    }

    this.config = {
      email: process.env.ANNOUNCEMENT_EMAIL,
      clientId: process.env.ANNOUNCEMENT_EMAIL_CLIENT_ID,
      clientSecret: process.env.ANNOUNCEMENT_EMAIL_CLIENT_SECRET,
      redirectUri: process.env.ANNOUNCEMENT_EMAIL_CLIENT_REDIRECT_URI,
      refreshToken: process.env.ANNOUNCEMENT_EMAIL_REFRESH_TOKEN,
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
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: this.config.email,
        clientId: this.config.clientId,
        clientSecret: this.config.clientSecret,
      },
    });

    this._initialized = true;
  }

  /**
   * Get OAuth access token (refreshes on each call).
   * Similar to emailSender.js pattern - refreshes token for each send to avoid stale tokens.
   * @returns {Promise<string>} Access token
   * @throws {Error} If token refresh fails
   */
  async getAccessToken() {
    this._initialize();
    const accessTokenResp = await this.OAuth2Client.getAccessToken();
    let token;

    if (accessTokenResp && typeof accessTokenResp === 'object' && accessTokenResp.token) {
      token = accessTokenResp.token;
    } else if (typeof accessTokenResp === 'string') {
      token = accessTokenResp;
    } else {
      throw new Error('Invalid access token response format');
    }

    if (!token) {
      throw new Error('NO_OAUTH_ACCESS_TOKEN: Failed to obtain access token');
    }

    return token;
  }

  /**
   * Send email with enhanced announcement tracking.
   * - Validates recipients, subject, and service configuration.
   * - Fetches OAuth2 access token and attaches OAuth credentials to the request.
   * - Returns a structured result instead of throwing to simplify callers.
   * @param {Object} mailOptions - Nodemailer-compatible options (to|bcc, subject, html, from?).
   * @returns {Promise<{success: boolean, response?: Object, error?: Error}>}
   */
  async sendEmail(mailOptions) {
    this._initialize();
    // Validation
    if (!mailOptions) {
      const error = new Error('INVALID_MAIL_OPTIONS: mailOptions is required');
      // logger.logException(error, 'EmailSendingService.sendEmail validation failed');
      return { success: false, error };
    }

    if (!mailOptions.to && !mailOptions.bcc) {
      const error = new Error('INVALID_RECIPIENTS: At least one recipient (to or bcc) is required');
      // logger.logException(error, 'EmailSendingService.sendEmail validation failed');
      return { success: false, error };
    }

    // Validate subject and htmlContent
    if (!mailOptions.subject || mailOptions.subject.trim() === '') {
      const error = new Error('INVALID_SUBJECT: Subject is required and cannot be empty');
      // logger.logException(error, 'EmailSendingService.sendEmail validation failed');
      return { success: false, error };
    }

    if (!this.config.email || !this.config.clientId || !this.config.clientSecret) {
      const error = new Error('INVALID_CONFIG: Email configuration is incomplete');
      // logger.logException(error, 'EmailSendingService.sendEmail configuration check failed');
      return { success: false, error };
    }

    try {
      // Get access token (refreshes on each send to avoid stale tokens)
      let token;
      try {
        token = await this.getAccessToken();
      } catch (tokenError) {
        const error = new Error(`OAUTH_TOKEN_ERROR: ${tokenError.message}`);
        // logger.logException(error, 'EmailSendingService.sendEmail OAuth token refresh failed');
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
      // logger.logInfo(
      //   `Announcement email sent to: ${mailOptions.to || mailOptions.bcc || 'unknown'}`,
      //   result,
      // );

      return { success: true, response: result };
    } catch (error) {
      // logger.logException(
      //   error,
      //   `Error sending announcement email to: ${mailOptions.to || mailOptions.bcc || 'unknown'}`,
      // );
      return { success: false, error };
    }
  }

  /**
   * Send email with retry logic and announcement-specific handling.
   * - Executes exponential backoff between attempts: initialDelayMs * 2^(attempt-1).
   * - Never throws; returns final success/failure and attemptCount for auditing.
   * @param {Object} mailOptions - Nodemailer-compatible mail options.
   * @param {number} retries - Total attempts (>=1).
   * @param {number} initialDelayMs - Initial backoff delay in ms.
   * @returns {Promise<{success: boolean, response?: Object, error?: Error, attemptCount: number}>}
   */
  async sendWithRetry(mailOptions, retries = 3, initialDelayMs = 1000) {
    // Validation
    if (!mailOptions) {
      const error = new Error('INVALID_MAIL_OPTIONS: mailOptions is required');
      // logger.logException(error, 'EmailSendingService.sendWithRetry validation failed');
      return { success: false, error, attemptCount: 0 };
    }

    if (!Number.isInteger(retries) || retries < 1) {
      const error = new Error('INVALID_RETRIES: retries must be a positive integer');
      // logger.logException(error, 'EmailSendingService.sendWithRetry validation failed');
      return { success: false, error, attemptCount: 0 };
    }

    let attemptCount = 0;

    /* eslint-disable no-await-in-loop */
    for (let attempt = 1; attempt <= retries; attempt += 1) {
      attemptCount += 1;

      try {
        const result = await this.sendEmail(mailOptions);

        if (result.success) {
          // Store Gmail response for audit logging
          mailOptions.gmailResponse = result.response;
          // logger.logInfo(
          //   `Email sent successfully on attempt ${attempt} to: ${mailOptions.to || mailOptions.bcc || 'unknown'}`,
          // );
          return { success: true, response: result.response, attemptCount };
        }
        // result.success is false - log and try again or return
        const error = result.error || new Error('Unknown error from sendEmail');
        // logger.logException(
        //   error,
        //   `Announcement send attempt ${attempt} failed to: ${mailOptions.to || mailOptions.bcc || '(empty)'}`,
        // );

        // If this is the last attempt, return failure info
        if (attempt >= retries) {
          return { success: false, error, attemptCount };
        }
      } catch (err) {
        // Unexpected error (shouldn't happen since sendEmail now returns {success, error})
        // logger.logException(
        //   err,
        //   `Unexpected error in announcement send attempt ${attempt} to: ${mailOptions.to || mailOptions.bcc || '(empty)'}`,
        // );

        // If this is the last attempt, return failure info
        if (attempt >= retries) {
          return { success: false, error: err, attemptCount };
        }
      }

      // Exponential backoff before retry (2^n: 1x, 2x, 4x, 8x, ...)
      if (attempt < retries) {
        const delay = initialDelayMs * 2 ** (attempt - 1);
        await EmailSendingService.sleep(delay);
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
   * Sleep utility for backoff timing.
   * @param {number} ms - Milliseconds to wait.
   * @returns {Promise<void>}
   */
  static sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}

// Create singleton instance
const emailSendingService = new EmailSendingService();

module.exports = emailSendingService;
