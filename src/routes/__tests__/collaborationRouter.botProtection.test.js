// End-to-end through the real router, multipart parsing and controller; only storage, email and
// the models are mocked.
jest.mock('../../models/JobFormsModel');
jest.mock('../../models/jobApplicationsModel');
jest.mock('../../models/questionSet');
jest.mock('../../utilities/AzureBlobImages');
jest.mock('../../utilities/emailSender');
jest.mock('../../utilities/jobFormPermissions', () => ({
  canManageJobForms: jest.fn(),
  canCreateFormQuestions: jest.fn(),
  canEditFormQuestions: jest.fn(),
  canDeleteFormQuestions: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const Form = require('../../models/JobFormsModel');
const Response = require('../../models/jobApplicationsModel');
const emailSender = require('../../utilities/emailSender');

const FORM_ID = '507f1f77bcf86cd799439011';
const URL = `/jobforms/${FORM_ID}/responses`;
const SECRET_ENV = 'TURNSTILE_SECRET_KEY';

// Limiter counters live in module singletons, so every request gets its own IP and email unless
// a test sets them explicitly.
let counter = 0;

const buildApp = () => {
  // eslint-disable-next-line global-require
  const router = require('../collaborationRouter');
  const app = express();
  app.set('trust proxy', 1);
  app.use(router);
  return app;
};

const submit = (app, fields, ip) => {
  counter += 1;
  const req = request(app)
    .post(URL)
    .set('X-Forwarded-For', ip || `198.51.100.${counter}`);
  const all = {
    respondent: 'Ada Lovelace',
    email: `applicant${counter}@example.com`,
    answers: '[]',
    ...(fields || {}),
  };
  Object.entries(all).forEach(([k, v]) => req.field(k, v));
  return req;
};

describe('POST /jobforms/:formId/responses bot protection', () => {
  const originalFetch = global.fetch;
  const originalSecret = process.env[SECRET_ENV];
  let saveMock;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env[SECRET_ENV];
    saveMock = jest.fn().mockResolvedValue(true);
    Form.findById = jest.fn().mockResolvedValue({ title: 'Dev', _id: FORM_ID, questions: [] });
    Response.findOne = jest.fn().mockResolvedValue(null);
    Response.mockImplementation((data) => ({ ...data, save: saveMock }));
    emailSender.mockResolvedValue('ok');
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalSecret === undefined) delete process.env[SECRET_ENV];
    else process.env[SECRET_ENV] = originalSecret;
    jest.restoreAllMocks();
  });

  it('saves a normal submission', async () => {
    const res = await submit(buildApp(), { fillMs: '8000', website_url: '' });
    expect(res.status).toBe(201);
    expect(saveMock).toHaveBeenCalledTimes(1);
  });

  it('allows a submission with no fillMs (old cached frontend)', async () => {
    const res = await submit(buildApp());
    expect(res.status).toBe(201);
    expect(saveMock).toHaveBeenCalledTimes(1);
  });

  it('answers a filled honeypot with a normal 201 and saves nothing', async () => {
    const res = await submit(buildApp(), {
      email: 'ada@example.com',
      website_url: 'http://spam.example',
      fillMs: '9000',
    });
    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Application submitted successfully.');
    expect(Form.findById).not.toHaveBeenCalled();
    expect(saveMock).not.toHaveBeenCalled();
    expect(emailSender).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledTimes(1);
    const line = console.warn.mock.calls[0][0];
    expect(line).toContain('honeypot');
    expect(line).toContain('a***@example.com');
    expect(line).not.toContain('ada@example.com');
  });

  it('answers a fast fill (under 3000 ms) with a normal 201 and saves nothing', async () => {
    const res = await submit(buildApp(), { fillMs: '1200' });
    expect(res.status).toBe(201);
    expect(saveMock).not.toHaveBeenCalled();
    expect(console.warn.mock.calls[0][0]).toContain('fast fill');
  });

  it('accepts exactly 3000 ms', async () => {
    const res = await submit(buildApp(), { fillMs: '3000' });
    expect(res.status).toBe(201);
    expect(saveMock).toHaveBeenCalledTimes(1);
  });

  it('does not count bot-dropped requests against the email limit', async () => {
    const app = buildApp();
    for (let i = 0; i < 6; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await submit(app, { email: 'carol@example.com', fillMs: '100' }, `10.0.0.${i}`);
    }
    const res = await submit(app, { email: 'carol@example.com', fillMs: '9000' }, '10.0.1.1');
    expect(res.status).toBe(201);
    expect(saveMock).toHaveBeenCalledTimes(1);
  });

  it('returns 429 with Retry-After after 10 submissions from one IP, other IPs unaffected', async () => {
    const app = buildApp();
    for (let i = 0; i < 10; i += 1) {
      // Distinct emails so only the IP limit can fire.
      // eslint-disable-next-line no-await-in-loop
      const ok = await submit(app, { email: `user${i}@example.com`, fillMs: '9000' }, '5.5.5.5');
      expect(ok.status).toBe(201);
    }
    const blocked = await submit(app, { email: 'user99@example.com', fillMs: '9000' }, '5.5.5.5');
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({
      error: 'Too many applications from this connection. Please try again later.',
    });
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);

    const other = await submit(app, { email: 'user100@example.com', fillMs: '9000' }, '6.6.6.6');
    expect(other.status).toBe(201);
  });

  it('returns 429 after 5 submissions for one email, other emails unaffected', async () => {
    const app = buildApp();
    for (let i = 0; i < 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const ok = await submit(app, { email: ' ADA@example.com', fillMs: '9000' }, `7.7.7.${i}`);
      expect(ok.status).toBe(201);
    }
    const blocked = await submit(app, { email: 'ada@example.com', fillMs: '9000' }, '7.7.7.9');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatch(/^Too many applications for this email address/);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);

    const other = await submit(app, { email: 'bob@example.com', fillMs: '9000' }, '7.7.7.10');
    expect(other.status).toBe(201);
  });

  describe('Turnstile', () => {
    it('is skipped when no secret is configured', async () => {
      global.fetch = jest.fn();
      const res = await submit(buildApp(), { fillMs: '9000' });
      expect(res.status).toBe(201);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('rejects a missing token with 400 when configured', async () => {
      process.env[SECRET_ENV] = 'secret';
      global.fetch = jest.fn();
      const res = await submit(buildApp(), { fillMs: '9000' });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Verification failed. Please try again.' });
      expect(saveMock).not.toHaveBeenCalled();
    });

    it('rejects a bad token with 400', async () => {
      process.env[SECRET_ENV] = 'secret';
      global.fetch = jest
        .fn()
        .mockResolvedValue({ ok: true, json: async () => ({ success: false }) });
      const res = await submit(buildApp(), { fillMs: '9000', 'cf-turnstile-response': 'bad' });
      expect(res.status).toBe(400);
      expect(saveMock).not.toHaveBeenCalled();
    });

    it('accepts a good token', async () => {
      process.env[SECRET_ENV] = 'secret';
      global.fetch = jest
        .fn()
        .mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
      const res = await submit(buildApp(), { fillMs: '9000', 'cf-turnstile-response': 'good' });
      expect(res.status).toBe(201);
      expect(saveMock).toHaveBeenCalledTimes(1);
    });

    it('fails open when Cloudflare is unreachable', async () => {
      process.env[SECRET_ENV] = 'secret';
      global.fetch = jest.fn().mockRejectedValue(new Error('network down'));
      const res = await submit(buildApp(), { fillMs: '9000', 'cf-turnstile-response': 'tok' });
      expect(res.status).toBe(201);
      expect(saveMock).toHaveBeenCalledTimes(1);
    });
  });
});
