// Proves the real HGN questionnaire submission path (hgnFormResponseController) and the
// help-request eligibility check (helpRequestEligibility) read/write the same persisted
// source: the same model (models/hgnFormResponse), keyed on the same `user_id` field.
jest.mock('../models/hgnFormResponse');
jest.mock('../models/userProfile', () => ({
  findById: jest.fn(),
}));
jest.mock('../utilities/permissions', () => ({
  hasPermission: jest.fn(),
}));

const FormResponse = require('../models/hgnFormResponse');
const UserProfile = require('../models/userProfile');
const { getHelpRequestEligibility } = require('../helpers/helpRequestEligibility');
const hgnFormController = require('./hgnFormResponseController');

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('HGN questionnaire submission -> help request eligibility (same persisted source)', () => {
  const AUTHENTICATED_USER_ID = '507f1f77bcf86cd799439011';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('a submitted HGNFormResponses document (real submission shape) yields questionnaireCompleted: true', async () => {
    // Mirrors the exact payload shape sent by FollowupQuestions.jsx (groupFormDataByPage).
    const submissionBody = {
      user_id: AUTHENTICATED_USER_ID,
      userInfo: { name: 'Test User', email: 'test@example.com', github: '', slack: '' },
      general: { hours: '10', period: 'week' },
      frontend: { overall: '5' },
      backend: { Overall: '5' },
      followUp: { platform: 'Slack' },
    };

    const savedDoc = { ...submissionBody, _id: 'formresponse1' };
    FormResponse.mockImplementation(() => ({
      ...savedDoc,
      save: jest.fn().mockResolvedValue(savedDoc),
    }));

    const { submitFormResponse } = hgnFormController();
    const req = { body: submissionBody };
    const res = makeRes();

    await submitFormResponse(req, res);

    expect(FormResponse).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: AUTHENTICATED_USER_ID }),
    );
    expect(res.status).toHaveBeenCalledWith(201);

    // Now the eligibility helper reads the same model, keyed on the same user_id.
    FormResponse.findOne = jest
      .fn()
      .mockReturnValue({ lean: jest.fn().mockResolvedValue(savedDoc) });
    UserProfile.findById.mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({ role: 'Owner', isActive: true, teams: [] }),
    });

    const eligibility = await getHelpRequestEligibility(AUTHENTICATED_USER_ID);

    expect(FormResponse.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        $or: expect.arrayContaining([{ user_id: expect.anything() }]),
      }),
    );
    expect(eligibility).toEqual({ eligible: true, questionnaireCompleted: true });
  });
});
