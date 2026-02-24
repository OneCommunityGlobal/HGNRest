const mockSendMail = jest.fn();
const mockGetAccessTokenOAuth = jest.fn();
const mockSetCredentials = jest.fn();

jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({ sendMail: mockSendMail }),
}));

jest.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: jest.fn().mockImplementation(() => ({
        setCredentials: mockSetCredentials,
        getAccessToken: mockGetAccessTokenOAuth,
      })),
    },
  },
}));

const nodemailer = require('nodemailer');
const { google } = require('googleapis');

describe('EmailSendingService', () => {
  let emailSendingService;
  let EmailSendingService;

  const ENV_VARS = {
    ANNOUNCEMENT_EMAIL: 'test@example.com',
    ANNOUNCEMENT_EMAIL_CLIENT_ID: 'client-id',
    ANNOUNCEMENT_EMAIL_CLIENT_SECRET: 'client-secret',
    ANNOUNCEMENT_EMAIL_CLIENT_REDIRECT_URI: 'https://redirect.uri',
    ANNOUNCEMENT_EMAIL_REFRESH_TOKEN: 'refresh-token',
  };

  beforeEach(() => {
    jest.useFakeTimers();

    // Set env vars
    Object.assign(process.env, ENV_VARS);

    // Re-require to get a fresh singleton each test
    jest.isolateModules(() => {
      emailSendingService = require('../emailSendingService');
      // Access the class for static method tests
      EmailSendingService = emailSendingService.constructor;
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    jest.restoreAllMocks();
    // Clean env vars
    Object.keys(ENV_VARS).forEach((key) => {
      delete process.env[key];
    });
  });

  // ── constructor ─────────────────────────────────────────────────────
  describe('constructor', () => {
    it('should initialize with lazy defaults', () => {
      expect(emailSendingService._initialized).toBe(false);
      expect(emailSendingService.config).toBeNull();
      expect(emailSendingService.OAuth2Client).toBeNull();
      expect(emailSendingService.transporter).toBeNull();
    });
  });

  // ── _initialize ─────────────────────────────────────────────────────
  describe('_initialize', () => {
    it('should throw when required env vars are missing', () => {
      delete process.env.ANNOUNCEMENT_EMAIL;
      delete process.env.ANNOUNCEMENT_EMAIL_CLIENT_ID;

      // Get a fresh instance with missing vars
      let freshService;
      jest.isolateModules(() => {
        freshService = require('../emailSendingService');
      });

      expect(() => freshService._initialize()).toThrow('Email config incomplete');
    });

    it('should initialize successfully with all env vars', () => {
      emailSendingService._initialize();

      expect(emailSendingService._initialized).toBe(true);
      expect(emailSendingService.config.email).toBe(ENV_VARS.ANNOUNCEMENT_EMAIL);
      expect(google.auth.OAuth2).toHaveBeenCalled();
      expect(mockSetCredentials).toHaveBeenCalledWith({
        refresh_token: ENV_VARS.ANNOUNCEMENT_EMAIL_REFRESH_TOKEN,
      });
      expect(nodemailer.createTransport).toHaveBeenCalled();
    });

    it('should skip if already initialized', () => {
      emailSendingService._initialize();
      emailSendingService._initialize(); // second call

      // OAuth2 constructor should only be called once
      expect(google.auth.OAuth2).toHaveBeenCalledTimes(1);
    });
  });

  // ── getAccessToken ──────────────────────────────────────────────────
  describe('getAccessToken', () => {
    it('should return token from object response', async () => {
      mockGetAccessTokenOAuth.mockResolvedValue({ token: 'access-123' });
      const token = await emailSendingService.getAccessToken();
      expect(token).toBe('access-123');
    });

    it('should return token from string response', async () => {
      mockGetAccessTokenOAuth.mockResolvedValue('access-str');
      const token = await emailSendingService.getAccessToken();
      expect(token).toBe('access-str');
    });

    it('should throw on invalid token format', async () => {
      mockGetAccessTokenOAuth.mockResolvedValue(12345);
      await expect(emailSendingService.getAccessToken()).rejects.toThrow('Invalid access token');
    });

    it('should throw when token is null/empty', async () => {
      mockGetAccessTokenOAuth.mockResolvedValue({ token: null });
      await expect(emailSendingService.getAccessToken()).rejects.toThrow('Invalid access token');
    });
  });

  // ── sendEmail ───────────────────────────────────────────────────────
  describe('sendEmail', () => {
    beforeEach(() => {
      mockGetAccessTokenOAuth.mockResolvedValue({ token: 'access-tk' });
    });

    it('should return failure for null mailOptions', async () => {
      const result = await emailSendingService.sendEmail(null);
      expect(result.success).toBe(false);
      expect(result.error.message).toContain('INVALID_MAIL_OPTIONS');
    });

    it('should return failure when no recipients', async () => {
      const result = await emailSendingService.sendEmail({ subject: 'Test' });
      expect(result.success).toBe(false);
      expect(result.error.message).toContain('INVALID_RECIPIENTS');
    });

    it('should return failure when subject empty', async () => {
      const result = await emailSendingService.sendEmail({ to: 'a@b.com', subject: '' });
      expect(result.success).toBe(false);
      expect(result.error.message).toContain('INVALID_SUBJECT');
    });

    it('should return failure when config is incomplete', async () => {
      emailSendingService._initialize();
      emailSendingService.config.email = null; // break config after init

      const result = await emailSendingService.sendEmail({
        to: 'a@b.com',
        subject: 'Test',
        html: '<p>Hi</p>',
      });
      expect(result.success).toBe(false);
      expect(result.error.message).toContain('INVALID_CONFIG');
    });

    it('should return failure on OAuth token error', async () => {
      mockGetAccessTokenOAuth.mockRejectedValue(new Error('Token expired'));

      const result = await emailSendingService.sendEmail({
        to: 'a@b.com',
        subject: 'Test',
        html: '<p>Hi</p>',
      });
      expect(result.success).toBe(false);
      expect(result.error.message).toContain('OAUTH_TOKEN_ERROR');
    });

    it('should return failure on transporter error', async () => {
      mockSendMail.mockRejectedValue(new Error('SMTP error'));

      const result = await emailSendingService.sendEmail({
        to: 'a@b.com',
        subject: 'Test',
        html: '<p>Hi</p>',
      });
      expect(result.success).toBe(false);
      expect(result.error.message).toContain('SMTP error');
    });

    it('should return success on successful send', async () => {
      const smtpResponse = { messageId: 'msg-1' };
      mockSendMail.mockResolvedValue(smtpResponse);

      const result = await emailSendingService.sendEmail({
        to: 'a@b.com',
        subject: 'Test',
        html: '<p>Hi</p>',
      });
      expect(result.success).toBe(true);
      expect(result.response).toEqual(smtpResponse);
    });

    it('should accept bcc instead of to', async () => {
      mockSendMail.mockResolvedValue({ messageId: 'msg-2' });

      const result = await emailSendingService.sendEmail({
        bcc: 'a@b.com',
        subject: 'Test',
        html: '<p>Hi</p>',
      });
      expect(result.success).toBe(true);
    });
  });

  // ── sendWithRetry ───────────────────────────────────────────────────
  describe('sendWithRetry', () => {
    beforeEach(() => {
      mockGetAccessTokenOAuth.mockResolvedValue({ token: 'access-tk' });
    });

    it('should return failure for null mailOptions', async () => {
      const result = await emailSendingService.sendWithRetry(null);
      expect(result.success).toBe(false);
      expect(result.attemptCount).toBe(0);
    });

    it('should return failure for invalid retries', async () => {
      const result = await emailSendingService.sendWithRetry({ to: 'a@b.com' }, 0);
      expect(result.success).toBe(false);
      expect(result.attemptCount).toBe(0);
    });

    it('should succeed on first attempt', async () => {
      mockSendMail.mockResolvedValue({ messageId: 'msg-1' });

      const result = await emailSendingService.sendWithRetry(
        { to: 'a@b.com', subject: 'Test', html: '<p>Hi</p>' },
        3,
        100,
      );
      expect(result.success).toBe(true);
      expect(result.attemptCount).toBe(1);
    });

    it('should retry on failure and succeed', async () => {
      mockSendMail
        .mockRejectedValueOnce(new Error('fail-1'))
        .mockResolvedValueOnce({ messageId: 'msg-ok' });

      const promise = emailSendingService.sendWithRetry(
        { to: 'a@b.com', subject: 'Test', html: '<p>Hi</p>' },
        3,
        100,
      );

      // Advance past the backoff delay
      await jest.advanceTimersByTimeAsync(200);
      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.attemptCount).toBe(2);
    });

    it('should return failure after max retries', async () => {
      mockSendMail.mockRejectedValue(new Error('always-fail'));

      const promise = emailSendingService.sendWithRetry(
        { to: 'a@b.com', subject: 'Test', html: '<p>Hi</p>' },
        2,
        100,
      );

      // Advance past the backoff delay
      await jest.advanceTimersByTimeAsync(500);
      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.attemptCount).toBe(2);
    });
  });

  // ── sleep ───────────────────────────────────────────────────────────
  describe('sleep', () => {
    it('should resolve after specified ms', async () => {
      const promise = EmailSendingService.sleep(1000);
      jest.advanceTimersByTime(1000);
      await expect(promise).resolves.toBeUndefined();
    });
  });
});
