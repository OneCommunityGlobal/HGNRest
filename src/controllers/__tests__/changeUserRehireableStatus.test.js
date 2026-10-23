jest.mock('../../utilities/permissions', () => ({
  hasPermission: jest.fn(),
  canRequestorUpdateUser: jest.fn(),
}));

jest.mock('../../utilities/nodeCache', () =>
  jest.fn(() => ({
    hasCache: jest.fn(() => false),
    getCache: jest.fn(),
    removeCache: jest.fn(),
    setCache: jest.fn(),
  })),
);

const { hasPermission, canRequestorUpdateUser } = require('../../utilities/permissions');
const userProfileController = require('../userProfileController');

const userId = '64a000000000000000000001';
const requestorId = '64a000000000000000000002';

const makeResponse = () => {
  const response = { status: jest.fn(), send: jest.fn() };
  response.status.mockReturnValue(response);
  return response;
};

const makeSubject = ({ currentUser, requestorProfile }) => {
  const model = {
    findById: jest.fn((id) => {
      if (id === userId) return Promise.resolve(currentUser);
      return { select: jest.fn().mockResolvedValue(requestorProfile) };
    }),
    findByIdAndUpdate: jest.fn(async (id, update) => {
      const updated = { ...currentUser, ...update.$set };
      if (update.$push?.notRehireableReasonHistory) {
        updated.notRehireableReasonHistory = [
          ...(currentUser.notRehireableReasonHistory || []),
          update.$push.notRehireableReasonHistory,
        ];
      }
      return updated;
    }),
  };
  return {
    model,
    changeUserRehireableStatus: userProfileController(model).changeUserRehireableStatus,
  };
};

describe('changeUserRehireableStatus', () => {
  const requestorProfile = {
    _id: requestorId,
    email: 'admin@example.org',
    firstName: 'Alex',
    lastName: 'Admin',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    hasPermission.mockResolvedValue(true);
    canRequestorUpdateUser.mockResolvedValue(true);
  });

  it('rejects a missing or blank reason without updating the profile', async () => {
    const { model, changeUserRehireableStatus } = makeSubject({
      currentUser: { _id: userId, isRehireable: true },
      requestorProfile,
    });
    const req = {
      params: { userId },
      body: { isRehireable: false, notRehireableReason: '   ', requestor: { requestorId } },
    };
    const res = makeResponse();

    await changeUserRehireableStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      error: 'A reason is required when a user is not rehireable',
    });
    expect(model.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('saves a new reason with the requestor identity and timestamp', async () => {
    const { model, changeUserRehireableStatus } = makeSubject({
      currentUser: { _id: userId, isRehireable: true, notRehireableReasonHistory: [] },
      requestorProfile,
    });
    const req = {
      params: { userId },
      body: {
        isRehireable: false,
        notRehireableReason: '  Missed commitments  ',
        requestor: { requestorId },
      },
    };
    const res = makeResponse();

    await changeUserRehireableStatus(req, res);

    const [updatedId, update] = model.findByIdAndUpdate.mock.calls[0];
    expect(updatedId).toBe(userId);
    expect(update.$set).toEqual({
      isRehireable: false,
      notRehireableReason: 'Missed commitments',
    });
    expect(update.$push.notRehireableReasonHistory).toMatchObject({
      action: 'submitted',
      reason: 'Missed commitments',
      changedBy: {
        userId: requestorId,
        username: 'admin@example.org',
        firstName: 'Alex',
        lastName: 'Admin',
      },
    });
    expect(update.$push.notRehireableReasonHistory.changedAt).toBeInstanceOf(Date);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({ isRehireable: false, notRehireableReason: 'Missed commitments' }),
    );
  });

  it('logs an edited reason and retains the previous history', async () => {
    const previousEntry = { action: 'submitted', reason: 'Earlier reason' };
    const { model, changeUserRehireableStatus } = makeSubject({
      currentUser: {
        _id: userId,
        isRehireable: false,
        notRehireableReason: 'Earlier reason',
        notRehireableReasonHistory: [previousEntry],
      },
      requestorProfile,
    });
    const req = {
      params: { userId },
      body: {
        isRehireable: false,
        notRehireableReason: 'Updated reason',
        requestor: { requestorId },
      },
    };
    const res = makeResponse();

    await changeUserRehireableStatus(req, res);

    const update = model.findByIdAndUpdate.mock.calls[0][1];
    expect(update.$push.notRehireableReasonHistory).toMatchObject({
      action: 'edited',
      reason: 'Updated reason',
    });
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        notRehireableReasonHistory: [previousEntry, update.$push.notRehireableReasonHistory],
      }),
    );
  });

  it('clears the active reason when rehireable while preserving the audit history', async () => {
    const previousEntry = { action: 'submitted', reason: 'Earlier reason' };
    const { model, changeUserRehireableStatus } = makeSubject({
      currentUser: {
        _id: userId,
        isRehireable: false,
        notRehireableReason: 'Earlier reason',
        notRehireableReasonHistory: [previousEntry],
      },
      requestorProfile,
    });
    const req = {
      params: { userId },
      body: { isRehireable: true, requestor: { requestorId } },
    };
    const res = makeResponse();

    await changeUserRehireableStatus(req, res);

    const update = model.findByIdAndUpdate.mock.calls[0][1];
    expect(update.$set).toEqual({ isRehireable: true, notRehireableReason: '' });
    expect(update.$push).toBeUndefined();
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        notRehireableReason: '',
        notRehireableReasonHistory: [previousEntry],
      }),
    );
  });
});
