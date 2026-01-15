const mongoose = require('mongoose');

/* =======================
   MOCKS (MUST COME FIRST)
   ======================= */

jest.mock('../../models/userProfile', () => ({
  findById: jest.fn(),
  find: jest.fn(),
  aggregate: jest.fn(),
}));

/* =======================
   IMPORTS AFTER MOCKS
   ======================= */

const userProfile = require('../../models/userProfile');
const userHelperFactory = require('../userHelper');

const { getUserName, validateProfilePic, checkTeamCodeMismatch, getTeamManagementEmail } =
  userHelperFactory();

/* =======================
   TESTS
   ======================= */

describe('getUserName', () => {
  test('calls findById with ObjectId and projection', async () => {
    const id = new mongoose.Types.ObjectId().toString();

    userProfile.findById.mockResolvedValue({
      firstName: 'John',
      lastName: 'Doe',
    });

    const result = await getUserName(id);

    expect(userProfile.findById).toHaveBeenCalledWith(
      expect.any(mongoose.Types.ObjectId),
      'firstName lastName',
    );
    expect(result).toEqual({ firstName: 'John', lastName: 'Doe' });
  });
});

describe('validateProfilePic', () => {
  test('returns invalid for non-string', () => {
    const res = validateProfilePic(null);
    expect(res.result).toBe(false);
  });

  test('accepts http/https url', () => {
    const res = validateProfilePic('https://example.com/image.png');
    expect(res.result).toBe(true);
  });

  test('rejects invalid base64 format', () => {
    const res = validateProfilePic('invalidbase64');
    expect(res.result).toBe(false);
  });

  test('rejects oversized image', () => {
    const largeBase64 = `data:image/png;base64,${'a'.repeat(300000)}`;
    const res = validateProfilePic(largeBase64);

    expect(res.result).toBe(false);
    expect(res.errors).toContain('Image size should not exceed 50KB');
  });

  test('rejects invalid image type', () => {
    const base64 = `data:image/gif;base64,${'a'.repeat(100)}`;
    const res = validateProfilePic(base64);

    expect(res.result).toBe(false);
  });

  test('accepts valid png image', () => {
    const base64 = `data:image/png;base64,${'a'.repeat(100)}`;
    const res = validateProfilePic(base64);

    expect(res.result).toBe(true);
  });
});

describe('checkTeamCodeMismatch', () => {
  const validTeamId = new mongoose.Types.ObjectId().toString();

  test('returns false if user missing', async () => {
    expect(await checkTeamCodeMismatch(null)).toBe(false);
  });

  test('returns false if no teams', async () => {
    expect(await checkTeamCodeMismatch({ teams: [] })).toBe(false);
  });

  test('returns false if no team code found', async () => {
    userProfile.aggregate.mockResolvedValue([]);

    const user = {
      teams: [validTeamId],
      teamCode: 'ABC',
    };

    expect(await checkTeamCodeMismatch(user)).toBe(false);
  });

  test('returns true on mismatch', async () => {
    userProfile.aggregate.mockResolvedValue([{ teamCode: 'XYZ' }]);

    const user = {
      teams: [validTeamId],
      teamCode: 'ABC',
    };

    expect(await checkTeamCodeMismatch(user)).toBe(true);
  });

  test('returns false on exception', async () => {
    userProfile.aggregate.mockRejectedValue(new Error('fail'));

    const user = {
      teams: [validTeamId],
      teamCode: 'ABC',
    };

    expect(await checkTeamCodeMismatch(user)).toBe(false);
  });
});

describe('getTeamManagementEmail', () => {
  test('queries active managers/admins by team', () => {
    userProfile.find.mockReturnValue({ exec: jest.fn() });

    const teamId = new mongoose.Types.ObjectId().toString();
    getTeamManagementEmail(teamId);

    expect(userProfile.find).toHaveBeenCalledWith(
      expect.objectContaining({
        isActive: true,
        role: { $in: ['Manager', 'Administrator'] },
      }),
      'email role',
    );
  });
});
