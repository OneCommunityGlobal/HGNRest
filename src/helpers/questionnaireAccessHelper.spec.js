jest.mock('../models/applicationAccess');
jest.mock('../models/userProfile');

const ApplicationAccess = require('../models/applicationAccess');
const UserProfile = require('../models/userProfile');
const { getQuestionnaireAccess, REASONS } = require('./questionnaireAccessHelper');

const mockLean = (value) => ({ lean: jest.fn().mockResolvedValue(value) });
const requestor = { requestorId: 'user1', role: 'Volunteer' };

describe('getQuestionnaireAccess', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    UserProfile.findById = jest.fn().mockReturnValue(mockLean({ _id: 'user1', isActive: true }));
    ApplicationAccess.findOne = jest.fn().mockReturnValue(
      mockLean({
        userId: 'user1',
        apps: [{ app: 'dropbox', status: 'invited', invitedOn: 'd' }],
      }),
    );
  });

  it('is eligible when the user was invited to Dropbox', async () => {
    await expect(getQuestionnaireAccess(requestor)).resolves.toEqual({
      eligible: true,
      reason: null,
      invitedOn: 'd',
    });
    expect(ApplicationAccess.findOne).toHaveBeenCalledWith({ userId: 'user1' });
  });

  it('is not eligible without a logged-in requestor', async () => {
    await expect(getQuestionnaireAccess(undefined)).resolves.toEqual({
      eligible: false,
      reason: REASONS.NOT_LOGGED_IN,
    });
  });

  it('lets Owners through without a Dropbox invite', async () => {
    const result = await getQuestionnaireAccess({ requestorId: 'owner', role: 'Owner' });
    expect(result.eligible).toBe(true);
    expect(ApplicationAccess.findOne).not.toHaveBeenCalled();
  });

  it('is not eligible when the user does not exist', async () => {
    UserProfile.findById.mockReturnValue(mockLean(null));
    const result = await getQuestionnaireAccess(requestor);
    expect(result).toEqual({ eligible: false, reason: REASONS.USER_NOT_FOUND });
  });

  it('is not eligible when the user is inactive', async () => {
    UserProfile.findById.mockReturnValue(mockLean({ _id: 'user1', isActive: false }));
    const result = await getQuestionnaireAccess(requestor);
    expect(result).toEqual({ eligible: false, reason: REASONS.INACTIVE });
  });

  it('is not eligible when the user has no access record', async () => {
    ApplicationAccess.findOne.mockReturnValue(mockLean(null));
    const result = await getQuestionnaireAccess(requestor);
    expect(result).toEqual({ eligible: false, reason: REASONS.NOT_INVITED });
  });

  it('is not eligible when only other apps were invited', async () => {
    ApplicationAccess.findOne.mockReturnValue(
      mockLean({ userId: 'user1', apps: [{ app: 'github', status: 'invited' }] }),
    );
    const result = await getQuestionnaireAccess(requestor);
    expect(result).toEqual({ eligible: false, reason: REASONS.NOT_INVITED });
  });

  it('is not eligible when Dropbox access was revoked', async () => {
    ApplicationAccess.findOne.mockReturnValue(
      mockLean({ userId: 'user1', apps: [{ app: 'dropbox', status: 'revoked' }] }),
    );
    const result = await getQuestionnaireAccess(requestor);
    expect(result).toEqual({ eligible: false, reason: REASONS.ACCESS_REVOKED });
  });
});
