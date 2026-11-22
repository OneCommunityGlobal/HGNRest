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
  lean: jest.fn().mockResolvedValue(profile),
});

const mockFormResponseQuery = (response) => ({
  lean: jest.fn().mockResolvedValue(response),
});

describe('getHelpRequestEligibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns ineligible for a missing userId', async () => {
    const result = await getHelpRequestEligibility(undefined);

    expect(result).toEqual({
      eligible: false,
      questionnaireCompleted: false,
    });
  });

  it('returns ineligible for a malformed userId', async () => {
    const result = await getHelpRequestEligibility('not-a-valid-id');

    expect(result).toEqual({
      eligible: false,
      questionnaireCompleted: false,
    });
  });

  it('returns ineligible when the user profile does not exist', async () => {
    UserProfile.findById.mockReturnValue(mockProfileQuery(null));
    HGNFormResponses.findOne.mockReturnValue(mockFormResponseQuery(null));

    const result = await getHelpRequestEligibility(VALID_OID);

    expect(result).toEqual({
      eligible: false,
      questionnaireCompleted: false,
    });
  });

  it('allows an Owner without completing the questionnaire', async () => {
    UserProfile.findById.mockReturnValue(mockProfileQuery({ role: 'Owner' }));
    HGNFormResponses.findOne.mockReturnValue(mockFormResponseQuery(null));

    const result = await getHelpRequestEligibility(VALID_OID);

    expect(result).toEqual({
      eligible: true,
      questionnaireCompleted: false,
    });
  });

  it('allows an Administrator without completing the questionnaire', async () => {
    UserProfile.findById.mockReturnValue(mockProfileQuery({ role: 'Administrator' }));
    HGNFormResponses.findOne.mockReturnValue(mockFormResponseQuery(null));

    const result = await getHelpRequestEligibility(VALID_OID);

    expect(result).toEqual({
      eligible: true,
      questionnaireCompleted: false,
    });
  });

  it('allows a Core Team member without completing the questionnaire', async () => {
    UserProfile.findById.mockReturnValue(mockProfileQuery({ role: 'Core Team' }));
    HGNFormResponses.findOne.mockReturnValue(mockFormResponseQuery(null));

    const result = await getHelpRequestEligibility(VALID_OID);

    expect(result).toEqual({
      eligible: true,
      questionnaireCompleted: false,
    });
  });

  it('allows an Owner who completed the questionnaire', async () => {
    UserProfile.findById.mockReturnValue(mockProfileQuery({ role: 'Owner' }));
    HGNFormResponses.findOne.mockReturnValue(mockFormResponseQuery({ _id: 'response1' }));

    const result = await getHelpRequestEligibility(VALID_OID);

    expect(result).toEqual({
      eligible: true,
      questionnaireCompleted: true,
    });
  });

  it('allows a user with another role who completed the questionnaire', async () => {
    UserProfile.findById.mockReturnValue(mockProfileQuery({ role: 'Volunteer' }));
    HGNFormResponses.findOne.mockReturnValue(mockFormResponseQuery({ _id: 'response1' }));

    const result = await getHelpRequestEligibility(VALID_OID);

    expect(result).toEqual({
      eligible: true,
      questionnaireCompleted: true,
    });
  });

  it('denies a user with another role who has not completed the questionnaire', async () => {
    UserProfile.findById.mockReturnValue(mockProfileQuery({ role: 'Volunteer' }));
    HGNFormResponses.findOne.mockReturnValue(mockFormResponseQuery(null));

    const result = await getHelpRequestEligibility(VALID_OID);

    expect(result).toEqual({
      eligible: false,
      questionnaireCompleted: false,
    });
  });

  it('handles role values case-insensitively', async () => {
    UserProfile.findById.mockReturnValue(mockProfileQuery({ role: ' ADMINISTRATOR ' }));
    HGNFormResponses.findOne.mockReturnValue(mockFormResponseQuery(null));

    const result = await getHelpRequestEligibility(VALID_OID);

    expect(result).toEqual({
      eligible: true,
      questionnaireCompleted: false,
    });
  });

  it('does not require team membership or active status when questionnaire is completed', async () => {
    UserProfile.findById.mockReturnValue(
      mockProfileQuery({
        role: 'Volunteer',
        isActive: false,
        teams: [{ teamName: 'Marketing' }],
      }),
    );
    HGNFormResponses.findOne.mockReturnValue(mockFormResponseQuery({ _id: 'response1' }));

    const result = await getHelpRequestEligibility(VALID_OID);

    expect(result).toEqual({
      eligible: true,
      questionnaireCompleted: true,
    });
  });

  it('does not grant access based on Software Development Team membership alone', async () => {
    UserProfile.findById.mockReturnValue(
      mockProfileQuery({
        role: 'Volunteer',
        isActive: true,
        teams: [{ teamName: 'Software Development Team' }],
      }),
    );
    HGNFormResponses.findOne.mockReturnValue(mockFormResponseQuery(null));

    const result = await getHelpRequestEligibility(VALID_OID);

    expect(result).toEqual({
      eligible: false,
      questionnaireCompleted: false,
    });
  });
});
