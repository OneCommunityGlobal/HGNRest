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
});
