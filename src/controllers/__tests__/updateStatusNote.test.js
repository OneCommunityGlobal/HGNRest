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

jest.mock('../../utilities/constants', () => ({
  ...jest.requireActual('../../utilities/constants'),
  PROTECTED_EMAIL_ACCOUNT: ['protected@example.org'],
}));

const { hasPermission, canRequestorUpdateUser } = require('../../utilities/permissions');
const cacheClosure = require('../../utilities/nodeCache');
const logger = require('../../startup/logger');
const userService = require('../../services/userService');
const userProfileController = require('../userProfileController');

const userId = '64a000000000000000000001';
const requestorId = '64a000000000000000000002';

const requestorProfile = {
  _id: requestorId,
  email: 'admin@example.org',
  firstName: 'Alex',
  lastName: 'Admin',
};

const makeResponse = () => {
  const response = { status: jest.fn(), send: jest.fn() };
  response.status.mockReturnValue(response);
  return response;
};

const makeSubject = (currentUser) => {
  const model = {
    findById: jest.fn((id) => ({
      select: jest.fn().mockResolvedValue(id === userId ? currentUser : requestorProfile),
    })),
    findByIdAndUpdate: jest.fn(async (id, update) => ({
      ...currentUser,
      ...update.$set,
      statusNoteHistory: [
        ...(currentUser?.statusNoteHistory || []),
        update.$push.statusNoteHistory,
      ],
    })),
  };
  return { model, updateStatusNote: userProfileController(model).updateStatusNote };
};

const makeRequest = (statusNote, id = userId) => ({
  params: { userId: id },
  body: { statusNote, requestor: { requestorId } },
});

describe('updateStatusNote', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    hasPermission.mockResolvedValue(true);
    canRequestorUpdateUser.mockResolvedValue(true);
  });

  it('adds a new note with who added it and when', async () => {
    const { model, updateStatusNote } = makeSubject({ _id: userId, statusNoteHistory: [] });
    const res = makeResponse();

    await updateStatusNote(makeRequest('  Left for a new job  '), res);

    const [updatedId, update] = model.findByIdAndUpdate.mock.calls[0];
    expect(updatedId).toBe(userId);
    expect(update.$set).toEqual({ statusNote: 'Left for a new job' });
    expect(update.$push.statusNoteHistory).toMatchObject({
      action: 'added',
      note: 'Left for a new job',
      changedBy: {
        userId: requestorId,
        username: 'admin@example.org',
        firstName: 'Alex',
        lastName: 'Admin',
      },
    });
    expect(update.$push.statusNoteHistory.changedAt).toBeInstanceOf(Date);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({ statusNote: 'Left for a new job' }),
    );
  });

  it('logs an edit and keeps the earlier history', async () => {
    const previousEntry = { action: 'added', note: 'Old note' };
    const { model, updateStatusNote } = makeSubject({
      _id: userId,
      statusNote: 'Old note',
      statusNoteHistory: [previousEntry],
    });
    const res = makeResponse();

    await updateStatusNote(makeRequest('New note'), res);

    const update = model.findByIdAndUpdate.mock.calls[0][1];
    expect(update.$push.statusNoteHistory).toMatchObject({ action: 'edited', note: 'New note' });
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        statusNoteHistory: [previousEntry, update.$push.statusNoteHistory],
      }),
    );
  });

  it('deletes the note and records the removed text in the history', async () => {
    const { model, updateStatusNote } = makeSubject({
      _id: userId,
      statusNote: 'Old note',
      statusNoteHistory: [],
    });
    const res = makeResponse();

    await updateStatusNote(makeRequest(''), res);

    const update = model.findByIdAndUpdate.mock.calls[0][1];
    expect(update.$set).toEqual({ statusNote: '' });
    expect(update.$push.statusNoteHistory).toMatchObject({ action: 'deleted', note: 'Old note' });
    expect(res.send).toHaveBeenCalledWith(expect.objectContaining({ statusNote: '' }));
  });

  it('does not save or log anything when the note is unchanged', async () => {
    const { model, updateStatusNote } = makeSubject({
      _id: userId,
      statusNote: 'Same note',
      statusNoteHistory: [],
    });
    const res = makeResponse();

    await updateStatusNote(makeRequest(' Same note '), res);

    expect(model.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(expect.objectContaining({ message: 'Note unchanged' }));
  });

  it('does not log a delete when there was no note', async () => {
    const { model, updateStatusNote } = makeSubject({ _id: userId, statusNoteHistory: [] });
    const res = makeResponse();

    await updateStatusNote(makeRequest('   '), res);

    expect(model.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it.each([
    ['an invalid user ID', makeRequest('Note', 'invalid-id'), 'Bad Request'],
    ['a note that is not a string', makeRequest(42), 'statusNote must be a string'],
    [
      'a note over 2000 characters',
      makeRequest('a'.repeat(2001)),
      'The note must be 2000 characters or less',
    ],
  ])('rejects %s', async (_label, req, error) => {
    const { model, updateStatusNote } = makeSubject({ _id: userId });
    const res = makeResponse();

    await updateStatusNote(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({ error });
    expect(model.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('checks the change status permission and the protected account rule', async () => {
    const { model, updateStatusNote } = makeSubject({ _id: userId });
    hasPermission.mockResolvedValue(false);
    const res = makeResponse();

    await updateStatusNote(makeRequest('Note'), res);

    expect(hasPermission).toHaveBeenCalledWith({ requestorId }, 'changeUserStatus');
    expect(res.status).toHaveBeenCalledWith(403);
    expect(model.findByIdAndUpdate).not.toHaveBeenCalled();

    hasPermission.mockResolvedValue(true);
    canRequestorUpdateUser.mockResolvedValue(false);
    const protectedRes = makeResponse();

    await updateStatusNote(makeRequest('Note'), protectedRes);

    expect(canRequestorUpdateUser).toHaveBeenCalledWith(requestorId, userId);
    expect(protectedRes.status).toHaveBeenCalledWith(403);
  });

  it('returns 404 when the user does not exist', async () => {
    const { model, updateStatusNote } = makeSubject(null);
    const res = makeResponse();

    await updateStatusNote(makeRequest('Note'), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(model.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('returns 500 when saving fails', async () => {
    const { model, updateStatusNote } = makeSubject({ _id: userId, statusNoteHistory: [] });
    model.findByIdAndUpdate.mockRejectedValue(new Error('db down'));
    const res = makeResponse();

    await updateStatusNote(makeRequest('Note'), res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  // The controller's cache is the last one the mocked nodeCache made
  const latestCache = () => cacheClosure.mock.results.at(-1).value;

  it('updates the user in the cached user list after a save', async () => {
    const { updateStatusNote } = makeSubject({ _id: userId, statusNoteHistory: [] });
    const cache = latestCache();
    cache.hasCache.mockReturnValue(true);
    cache.getCache.mockReturnValue(
      JSON.stringify([{ _id: userId, firstName: 'Sam' }, { _id: 'someone-else' }]),
    );
    const res = makeResponse();

    await updateStatusNote(makeRequest('Cached note'), res);

    expect(cache.removeCache).toHaveBeenCalledWith(`user-${userId}`);
    const saved = JSON.parse(cache.setCache.mock.calls[0][1]);
    expect(cache.setCache.mock.calls[0][0]).toBe('allusers');
    expect(saved[0]).toMatchObject({ _id: userId, firstName: 'Sam', statusNote: 'Cached note' });
    expect(saved[0].statusNoteHistory).toHaveLength(1);
    expect(saved[1]).toEqual({ _id: 'someone-else' });
  });

  it('leaves the cached user list alone when the user is not in it', async () => {
    const { updateStatusNote } = makeSubject({ _id: userId, statusNoteHistory: [] });
    const cache = latestCache();
    cache.hasCache.mockReturnValue(true);
    cache.getCache.mockReturnValue(JSON.stringify([{ _id: 'someone-else' }]));
    const res = makeResponse();

    await updateStatusNote(makeRequest('Note'), res);

    expect(cache.setCache).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 404 when the requestor does not exist', async () => {
    const { model, updateStatusNote } = makeSubject({ _id: userId, statusNoteHistory: [] });
    model.findById.mockImplementation((id) => ({
      select: jest.fn().mockResolvedValue(id === userId ? { _id: userId } : null),
    }));
    const res = makeResponse();

    await updateStatusNote(makeRequest('Note'), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith({ error: 'Requestor not found' });
    expect(model.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('returns 404 when the user is gone by the time the note is saved', async () => {
    const { model, updateStatusNote } = makeSubject({ _id: userId, statusNoteHistory: [] });
    model.findByIdAndUpdate.mockResolvedValue(null);
    const res = makeResponse();

    await updateStatusNote(makeRequest('Note'), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith({ error: 'User not found' });
  });

  it('still saves the note and logs the error when the protected account audit fails', async () => {
    const { model, updateStatusNote } = makeSubject({
      _id: userId,
      email: 'protected@example.org',
      statusNoteHistory: [],
    });
    const auditError = new Error('audit lookup failed');
    jest.spyOn(userService, 'getUserFullNameAndEmailById').mockRejectedValue(auditError);
    const logSpy = jest.spyOn(logger, 'logException').mockImplementation(() => {});
    const res = makeResponse();

    await updateStatusNote(makeRequest('Note'), res);
    await new Promise((resolve) => {
      setImmediate(resolve);
    });

    expect(model.findByIdAndUpdate).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(logSpy).toHaveBeenCalledWith(auditError);
    logSpy.mockRestore();
  });

  it('refuses a request without a requestor', async () => {
    const { model, updateStatusNote } = makeSubject({ _id: userId });
    const res = makeResponse();

    await updateStatusNote({ params: { userId }, body: { statusNote: 'Note' } }, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(hasPermission).not.toHaveBeenCalled();
    expect(model.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('returns an empty history for an unchanged note with no history yet', async () => {
    const { updateStatusNote } = makeSubject({ _id: userId });
    const res = makeResponse();

    await updateStatusNote(makeRequest(''), res);

    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Note unchanged', statusNote: '', statusNoteHistory: [] }),
    );
  });
});
