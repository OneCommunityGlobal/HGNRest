jest.mock('sharp', () => jest.fn());
jest.mock('../../utilities/permissions', () => ({
  hasPermission: jest.fn(),
  canRequestorUpdateUser: jest.fn(),
}));
jest.mock('../../startup/logger', () => ({
  logException: jest.fn(),
  logInfo: jest.fn(),
}));

const mongoose = require('mongoose');
const { PRONOUN_OPTIONS, normalizePronouns } = require('../userProfile');
const { canRequestorUpdateUser, hasPermission } = require('../../utilities/permissions');
const userProfileController = require('../../controllers/userProfileController');
const profileInitialSetupController = require('../../controllers/profileInitialSetupController');
const cache = require('../../utilities/nodeCache')();

const makeRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.send = jest.fn(() => res);
  return res;
};

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

  it('rejects an invalid user id', async () => {
    const { updatePronouns, UserProfile } = makeSut();
    const res = makeRes();
    await updatePronouns(
      {
        params: { userId: 'not-an-id' },
        body: { pronouns: 'She/Her', requestor: { requestorId: 'not-an-id', role: 'Volunteer' } },
      },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(UserProfile.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('updates the cached user list with the new pronouns', async () => {
    cache.setCache('allusers', JSON.stringify([{ _id: userId, pronouns: '' }, { _id: otherId }]));
    const { updatePronouns } = makeSut({ _id: userId, pronouns: 'She/Her' });
    const res = makeRes();
    await updatePronouns(
      {
        params: { userId },
        body: { pronouns: 'She/Her', requestor: { requestorId: userId, role: 'Volunteer' } },
      },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(200);
    const cached = JSON.parse(cache.getCache('allusers'));
    expect(cached.find((u) => u._id === userId).pronouns).toBe('She/Her');
    cache.removeCache('allusers');
  });

  it('returns 500 when the update fails', async () => {
    const UserProfile = { findByIdAndUpdate: jest.fn().mockRejectedValue(new Error('db down')) };
    const { updatePronouns } = userProfileController(UserProfile, {});
    const res = makeRes();
    await updatePronouns(
      {
        params: { userId },
        body: { pronouns: 'She/Her', requestor: { requestorId: userId, role: 'Volunteer' } },
      },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('pronouns validation on user creation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects Create User with an invalid pronouns value', async () => {
    hasPermission.mockResolvedValue(true);
    const UserProfile = { findOne: jest.fn() };
    const { postUserProfile } = userProfileController(UserProfile, {});
    const res = makeRes();
    await postUserProfile(
      {
        body: {
          role: 'Volunteer',
          email: 'new.user@example.com',
          pronouns: 'Xe/Xem',
          requestor: { requestorId: new mongoose.Types.ObjectId().toString(), role: 'Owner' },
        },
      },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({ error: 'Invalid pronouns value' });
    expect(UserProfile.findOne).not.toHaveBeenCalled();
  });

  it('rejects the setup link form with an invalid pronouns value', async () => {
    const ProfileInitialSetupToken = { findOne: jest.fn() };
    const { setUpNewUser } = profileInitialSetupController(ProfileInitialSetupToken, {}, {}, {});
    const res = makeRes();
    await setUpNewUser({ body: { token: 'abc', pronouns: 'Xe/Xem' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith('Invalid pronouns value');
    expect(ProfileInitialSetupToken.findOne).not.toHaveBeenCalled();
  });
});
