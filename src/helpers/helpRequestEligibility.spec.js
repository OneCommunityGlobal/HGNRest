jest.mock('../models/userProfile', () => ({
  findById: jest.fn(),
}));
jest.mock('../models/hgnFormResponse', () => ({
  findOne: jest.fn(),
}));

const UserProfile = require('../models/userProfile');
const HGNFormResponses = require('../models/hgnFormResponse');
const { getHelpRequestEligibility } = require('./helpRequestEligibility');

const VALID_OID = '507f1f77bcf86cd799439011';

const mockProfileQuery = (profile) => ({
  populate: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(profile),
});

describe('getHelpRequestEligibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns ineligible for a missing/invalid userId', async () => {
    const result = await getHelpRequestEligibility(undefined);
    expect(result).toEqual({ eligible: false, questionnaireCompleted: false });
  });

  it('returns ineligible for a malformed userId', async () => {
    const result = await getHelpRequestEligibility('not-a-valid-id');
    expect(result).toEqual({ eligible: false, questionnaireCompleted: false });
  });

  it('denies safely when the user profile does not exist', async () => {
    UserProfile.findById.mockReturnValue(mockProfileQuery(null));
    HGNFormResponses.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

    const result = await getHelpRequestEligibility(VALID_OID);
    expect(result).toEqual({ eligible: false, questionnaireCompleted: false });
  });

  it('denies when the questionnaire has not been completed, even for an eligible role', async () => {
    UserProfile.findById.mockReturnValue(
      mockProfileQuery({ role: 'Administrator', isActive: true, teams: [] }),
    );
    HGNFormResponses.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

    const result = await getHelpRequestEligibility(VALID_OID);
    expect(result).toEqual({ eligible: false, questionnaireCompleted: false });
  });

  it('denies a questionnaire-completed user outside all allowed groups', async () => {
    UserProfile.findById.mockReturnValue(
      mockProfileQuery({ role: 'Volunteer', isActive: true, teams: [{ teamName: 'Marketing' }] }),
    );
    HGNFormResponses.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue({ _id: 'x' }) });

    const result = await getHelpRequestEligibility(VALID_OID);
    expect(result).toEqual({ eligible: false, questionnaireCompleted: true });
  });

  it('allows a Core Team member who completed the questionnaire', async () => {
    UserProfile.findById.mockReturnValue(
      mockProfileQuery({ role: 'Core Team', isActive: true, teams: [] }),
    );
    HGNFormResponses.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue({ _id: 'x' }) });

    const result = await getHelpRequestEligibility(VALID_OID);
    expect(result).toEqual({ eligible: true, questionnaireCompleted: true });
  });

  it('allows an Administrator who completed the questionnaire', async () => {
    UserProfile.findById.mockReturnValue(
      mockProfileQuery({ role: 'Administrator', isActive: true, teams: [] }),
    );
    HGNFormResponses.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue({ _id: 'x' }) });

    const result = await getHelpRequestEligibility(VALID_OID);
    expect(result).toEqual({ eligible: true, questionnaireCompleted: true });
  });

  it('allows an Owner who completed the questionnaire', async () => {
    UserProfile.findById.mockReturnValue(
      mockProfileQuery({ role: 'Owner', isActive: true, teams: [] }),
    );
    HGNFormResponses.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue({ _id: 'x' }) });

    const result = await getHelpRequestEligibility(VALID_OID);
    expect(result).toEqual({ eligible: true, questionnaireCompleted: true });
  });

  it('allows a Software Development Team member (non-exact team name) who completed the questionnaire', async () => {
    UserProfile.findById.mockReturnValue(
      mockProfileQuery({
        role: 'Volunteer',
        isActive: false,
        teams: [{ teamName: 'HGN Software Development Team' }],
      }),
    );
    HGNFormResponses.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue({ _id: 'x' }) });

    const result = await getHelpRequestEligibility(VALID_OID);
    expect(result).toEqual({ eligible: true, questionnaireCompleted: true });
  });

  it('allows an active Software Development Team member who completed the questionnaire', async () => {
    UserProfile.findById.mockReturnValue(
      mockProfileQuery({
        role: 'Volunteer',
        isActive: true,
        teams: [{ teamName: 'HGN Software Development Team' }],
      }),
    );
    HGNFormResponses.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue({ _id: 'x' }) });

    const result = await getHelpRequestEligibility(VALID_OID);
    expect(result).toEqual({ eligible: true, questionnaireCompleted: true });
  });

  it('handles unknown/malformed team information safely', async () => {
    UserProfile.findById.mockReturnValue(
      mockProfileQuery({ role: 'Volunteer', isActive: true, teams: [null, { teamName: null }] }),
    );
    HGNFormResponses.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue({ _id: 'x' }) });

    const result = await getHelpRequestEligibility(VALID_OID);
    expect(result).toEqual({ eligible: false, questionnaireCompleted: true });
  });
});
