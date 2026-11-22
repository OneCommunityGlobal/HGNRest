jest.mock('sharp', () => jest.fn());
jest.mock('../../utilities/permissions', () => ({
  hasPermission: jest.fn(),
  canRequestorUpdateUser: jest.fn(),
}));

const mongoose = require('mongoose');
const { PRONOUN_OPTIONS, normalizePronouns } = require('../userProfile');
const { canRequestorUpdateUser } = require('../../utilities/permissions');
const userProfileController = require('../../controllers/userProfileController');

describe('normalizePronouns', () => {
  it('accepts each allowed option', () => {
    PRONOUN_OPTIONS.forEach((option) => {
      expect(normalizePronouns(option)).toBe(option);
    });
  });

  it('trims surrounding whitespace', () => {
    expect(normalizePronouns('  She/Her ')).toBe('She/Her');
  });

  it('returns an empty string for missing or blank input', () => {
    expect(normalizePronouns(undefined)).toBe('');
    expect(normalizePronouns(null)).toBe('');
    expect(normalizePronouns('')).toBe('');
    expect(normalizePronouns('   ')).toBe('');
  });

  it('returns null for values outside the allowed list', () => {
    expect(normalizePronouns('he/him')).toBeNull();
    expect(normalizePronouns('Xe/Xem')).toBeNull();
    expect(normalizePronouns(5)).toBeNull();
  });
});

describe('updatePronouns', () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const otherId = new mongoose.Types.ObjectId().toString();

  const makeRes = () => {
    const res = {};
    res.status = jest.fn(() => res);
    res.send = jest.fn(() => res);
    return res;
  };

  const makeSut = (updatedDoc = { _id: userId, pronouns: 'They/Them' }) => {
    const UserProfile = { findByIdAndUpdate: jest.fn().mockResolvedValue(updatedDoc) };
    const { updatePronouns } = userProfileController(UserProfile, {});
    return { updatePronouns, UserProfile };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lets a user set their own pronouns', async () => {
    const { updatePronouns, UserProfile } = makeSut();
    const res = makeRes();
    await updatePronouns(
      {
        params: { userId },
        body: { pronouns: 'They/Them', requestor: { requestorId: userId, role: 'Volunteer' } },
      },
      res,
    );
    expect(UserProfile.findByIdAndUpdate).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({ $set: expect.objectContaining({ pronouns: 'They/Them' }) }),
      expect.objectContaining({ runValidators: true }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('lets an Owner update another user', async () => {
    canRequestorUpdateUser.mockResolvedValue(true);
    const { updatePronouns } = makeSut();
    const res = makeRes();
    await updatePronouns(
      {
        params: { userId },
        body: { pronouns: 'They/Them', requestor: { requestorId: otherId, role: 'Owner' } },
      },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('blocks a non-admin from updating someone else', async () => {
    const { updatePronouns, UserProfile } = makeSut();
    const res = makeRes();
    await updatePronouns(
      {
        params: { userId },
        body: { pronouns: 'He/Him', requestor: { requestorId: otherId, role: 'Manager' } },
      },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
    expect(UserProfile.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('blocks an Administrator from updating a protected account', async () => {
    canRequestorUpdateUser.mockResolvedValue(false);
    const { updatePronouns, UserProfile } = makeSut();
    const res = makeRes();
    await updatePronouns(
      {
        params: { userId },
        body: { pronouns: 'He/Him', requestor: { requestorId: otherId, role: 'Administrator' } },
      },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
    expect(UserProfile.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('rejects values outside the allowed list', async () => {
    const { updatePronouns, UserProfile } = makeSut();
    const res = makeRes();
    await updatePronouns(
      {
        params: { userId },
        body: { pronouns: 'Xe/Xem', requestor: { requestorId: userId, role: 'Volunteer' } },
      },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(UserProfile.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('returns 404 when the user does not exist', async () => {
    const { updatePronouns } = makeSut(null);
    const res = makeRes();
    await updatePronouns(
      {
        params: { userId },
        body: { pronouns: 'She/Her', requestor: { requestorId: userId, role: 'Volunteer' } },
      },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
