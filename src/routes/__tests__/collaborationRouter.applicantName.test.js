// End-to-end through the real router, multipart parsing, bot checks and controller, with the
// same fields the Job Application form sends. Only storage, email and the models are mocked.
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
const LETTERS_ONLY = 'Name may contain only letters, spaces, hyphens, and apostrophes.';

let counter = 0;

const buildApp = () => {
  // eslint-disable-next-line global-require
  const router = require('../collaborationRouter');
  const app = express();
  app.set('trust proxy', 1);
  app.use(router);
  return app;
};

// Mirrors JobApplicationForm.jsx: respondent plus a payload with applicantName.
const submitAs = (app, name) => {
  counter += 1;
  const email = `applicant${counter}@example.com`;
  return request(app)
    .post(URL)
    .set('X-Forwarded-For', `203.0.113.${counter}`)
    .field('respondent', name)
    .field('email', email)
    .field('answers', '[]')
    .field(
      'payload',
      JSON.stringify({ applicantName: name, applicantEmail: email, profile: {}, answers: [] }),
    )
    .field('website_url', '')
    .field('fillMs', '8000');
};

describe('POST /jobforms/:formId/responses applicant name', () => {
  let saveMock;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.TURNSTILE_SECRET_KEY;
    saveMock = jest.fn().mockResolvedValue(true);
    Form.findById = jest.fn().mockResolvedValue({ title: 'Dev', _id: FORM_ID, questions: [] });
    Response.findOne = jest.fn().mockResolvedValue(null);
    Response.countDocuments = jest.fn().mockResolvedValue(1);
    Response.mockImplementation((data) => ({ ...data, save: saveMock }));
    emailSender.mockResolvedValue('ok');
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ['digits', '123 456', LETTERS_ONLY],
    ['symbols', '@#$% &*', LETTERS_ONLY],
    ['an emoji', 'Ada 😀 Lovelace', LETTERS_ONLY],
    ['one character', 'A', 'Name must be at least 2 characters.'],
    ['500+ characters', 'a'.repeat(501), 'Name must not exceed 201 characters.'],
  ])('rejects a name with %s and saves nothing', async (_label, name, error) => {
    const res = await submitAs(buildApp(), name);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error });
    expect(saveMock).not.toHaveBeenCalled();
    expect(emailSender).not.toHaveBeenCalled();
  });

  it('accepts an accented, hyphenated name and saves it trimmed', async () => {
    const res = await submitAs(buildApp(), "  Zoë  O'Brien-Núñez ");
    expect(res.status).toBe(201);
    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(Response).toHaveBeenCalledWith(
      expect.objectContaining({ respondent: "Zoë O'Brien-Núñez" }),
    );
  });
});
