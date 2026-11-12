jest.mock('../../../models/bmdashboard/lessonTagBatch', () => ({
  create: jest.fn(),
  find: jest.fn(),
  findById: jest.fn(),
}));
jest.mock('../../../startup/logger', () => ({ logException: jest.fn() }));

const mongoose = require('mongoose');
const Batch = require('../../../models/bmdashboard/lessonTagBatch');
const factory = require('../bmBulkLessonTagController');

const lessonId = '111111111111111111111111';
const actorId = '222222222222222222222222';
const batchId = '333333333333333333333333';
const query = (value) => ({
  session: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(value) }),
});

describe('bulk lesson tags', () => {
  let Lesson;
  let controller;
  let req;
  let res;
  let session;
  beforeEach(() => {
    jest.clearAllMocks();
    session = { withTransaction: jest.fn((fn) => fn()), endSession: jest.fn() };
    jest.spyOn(mongoose, 'startSession').mockResolvedValue(session);
    Lesson = {
      find: jest.fn(() =>
        query([{ _id: lessonId, title: 'Safety', author: actorId, tags: ['old'] }]),
      ),
      distinct: jest.fn(() => ({ session: jest.fn().mockResolvedValue(['old', 'new']) })),
      updateOne: jest.fn().mockResolvedValue({ nModified: 1 }),
      findById: jest.fn(() => query({ author: actorId, tags: ['old', 'new'] })),
    };
    controller = factory(Lesson);
    req = {
      user: { requestorId: actorId, role: 'Volunteer' },
      body: {
        lessonIds: [lessonId],
        tags: ['new'],
        operation: 'add',
        expected: [{ lessonId, tags: ['old'] }],
      },
      params: { batchId },
    };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    Batch.create.mockResolvedValue([{ _id: batchId }]);
  });
  afterEach(() => jest.restoreAllMocks());

  test.each(['Owner', 'Administrator', 'Manager', 'Mentor', 'Volunteer', 'Core Team'])(
    '%s can edit their own lessons',
    async (role) => {
      req.user.role = role;
      await controller.preview(req, res);
      expect(res.json).toHaveBeenCalledWith({
        changes: [{ lessonId, title: 'Safety', before: ['old'], after: ['old', 'new'] }],
      });
      expect(Lesson.updateOne).not.toHaveBeenCalled();
    },
  );
  test.each(['Owner', 'Administrator', 'Admin', 'Manager', 'Mentor', 'Volunteer', 'Core Team'])(
    '%s enforces ownership for another author',
    async (role) => {
      req.user.role = role;
      Lesson.find.mockReturnValue(
        query([{ _id: lessonId, title: 'Other', author: batchId, tags: ['old'] }]),
      );
      await controller.apply(req, res);
      expect(res.status).toHaveBeenCalledWith(
        ['Owner', 'Administrator', 'Admin'].includes(role) ? 201 : 403,
      );
      if (!['Owner', 'Administrator', 'Admin'].includes(role)) {
        expect(Lesson.updateOne).not.toHaveBeenCalled();
        expect(Batch.create).not.toHaveBeenCalled();
      }
    },
  );
  test('preview rejects unauthorized lessons despite a forged client role', async () => {
    req.body.requestor = { requestorId: batchId, role: 'Owner' };
    Lesson.find.mockReturnValue(query([{ _id: lessonId, author: batchId, tags: ['old'] }]));
    await controller.preview(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(Lesson.updateOne).not.toHaveBeenCalled();
  });
  test('rejects unauthenticated requests before querying data', async () => {
    delete req.user;
    await controller.apply(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(Lesson.find).not.toHaveBeenCalled();
  });
  test.each([
    { lessonIds: [] },
    { lessonIds: ['invalid'] },
    { lessonIds: [lessonId, lessonId] },
    { tags: [] },
    { tags: ['too-long-tag'] },
    { tags: ['new', 'new'] },
    { tags: [' new'] },
    { operation: 'deleteAll' },
    { tags: [null] },
  ])('rejects invalid input %j', async (invalid) => {
    Object.assign(req.body, invalid);
    await controller.preview(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(Lesson.updateOne).not.toHaveBeenCalled();
  });
  test('rejects missing lessons', async () => {
    Lesson.find.mockReturnValue(query([]));
    await controller.apply(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(Lesson.updateOne).not.toHaveBeenCalled();
  });
  test('rejects tags that no longer exist', async () => {
    req.body.tags = ['missing'];
    await controller.preview(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });
  test('removes only selected tags and preserves all other tags', async () => {
    req.body.operation = 'remove';
    req.body.tags = ['old'];
    await controller.preview(req, res);
    expect(res.json.mock.calls[0][0].changes[0].after).toEqual([]);
  });
  test('records updates and audit snapshots in the same transaction', async () => {
    await controller.apply(req, res);
    expect(session.withTransaction).toHaveBeenCalledTimes(1);
    expect(Lesson.updateOne).toHaveBeenCalledWith(
      { _id: lessonId },
      { $set: { tags: ['old', 'new'] } },
      { session },
    );
    expect(Batch.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          actor: actorId,
          operation: 'add',
          changes: [expect.objectContaining({ before: ['old'], after: ['old', 'new'] })],
        }),
      ],
      { session },
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(session.endSession).toHaveBeenCalled();
  });
  test('rejects stale previews without writing', async () => {
    req.body.expected[0].tags = ['different'];
    await controller.apply(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(Lesson.updateOne).not.toHaveBeenCalled();
    expect(Batch.create).not.toHaveBeenCalled();
  });
  test('does not create audit entries for no-op batches', async () => {
    req.body.tags = ['old'];
    await controller.apply(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(Batch.create).not.toHaveBeenCalled();
  });
  test('reports transaction failures and closes the session', async () => {
    Batch.create.mockRejectedValue(new Error('audit failed'));
    await controller.apply(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(session.endSession).toHaveBeenCalled();
  });

  test('allows administrators to update selected Tag Storage records', async () => {
    req.user.role = 'Administrator';
    Lesson.find.mockReturnValue(
      query([
        { _id: lessonId, title: 'Tag Storage', author: '000000000000000000000000', tags: ['old'] },
      ]),
    );
    await controller.apply(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(Lesson.updateOne).toHaveBeenCalledWith(
      { _id: lessonId },
      { $set: { tags: ['old', 'new'] } },
      { session },
    );
  });

  test.each(['Volunteer', 'Administrator'])('scopes history for %s', async (role) => {
    req.user.role = role;
    Batch.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
      }),
    });
    await controller.history(req, res);
    expect(Batch.find).toHaveBeenCalledWith(role === 'Volunteer' ? { actor: actorId } : {});
    expect(res.json).toHaveBeenCalledWith([]);
  });

  test('uses the authenticated actor instead of a client-provided requestor', async () => {
    req.body.requestor = { requestorId: '444444444444444444444444', role: 'Owner' };
    await controller.apply(req, res);
    expect(Batch.create.mock.calls[0][0][0].actor).toBe(actorId);
  });

  describe('undo', () => {
    let batch;
    beforeEach(() => {
      batch = {
        actor: actorId,
        changes: [{ lessonId, before: ['old'], after: ['old', 'new'] }],
        save: jest.fn(),
      };
      Batch.findById.mockReturnValue({ session: jest.fn().mockResolvedValue(batch) });
    });
    test('restores original tags and retains rollback attribution', async () => {
      await controller.undo(req, res);
      expect(Lesson.updateOne).toHaveBeenCalledWith(
        { _id: lessonId },
        { $set: { tags: ['old'] } },
        { session },
      );
      expect(batch.undoneBy).toBe(actorId);
      expect(batch.undoneAt).toBeInstanceOf(Date);
      expect(batch.save).toHaveBeenCalledWith({ session });
    });
    test('rejects another user undoing a batch', async () => {
      batch.actor = '444444444444444444444444';
      await controller.undo(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(Lesson.updateOne).not.toHaveBeenCalled();
    });
    test('allows an administrator to undo a batch', async () => {
      req.user.role = 'Administrator';
      batch.actor = '444444444444444444444444';
      await controller.undo(req, res);
      expect(batch.save).toHaveBeenCalled();
    });
    test('preserves newer tag edits', async () => {
      Lesson.findById.mockReturnValue(query({ author: actorId, tags: ['old', 'new', 'later'] }));
      await controller.undo(req, res);
      expect(res.status).toHaveBeenCalledWith(409);
      expect(Lesson.updateOne).not.toHaveBeenCalled();
    });
    test('rejects repeated undo', async () => {
      batch.undoneAt = new Date();
      await controller.undo(req, res);
      expect(res.status).toHaveBeenCalledWith(409);
    });
    test('rejects undo after lesson ownership changes', async () => {
      Lesson.findById.mockReturnValue(query({ author: batchId, tags: ['old', 'new'] }));
      await controller.undo(req, res);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(Lesson.updateOne).not.toHaveBeenCalled();
      expect(batch.save).not.toHaveBeenCalled();
    });
  });
});
