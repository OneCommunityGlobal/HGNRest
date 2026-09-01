jest.mock('../models/xScheduledPost', () => ({
  create: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  findOneAndDelete: jest.fn(),
  findOneAndUpdate: jest.fn(),
  countDocuments: jest.fn(),
}));
jest.mock('../utilities/permissions', () => ({ hasPermission: jest.fn() }));

const XScheduledPost = require('../models/xScheduledPost');
const { hasPermission } = require('../utilities/permissions');
const controller = require('./xPostController');

const postedFilter = { status: 'posted' };
const requestorId = '64b7f94e12c9a93bf4a83961';
const permissionHolder = { requestorId, role: 'Volunteer' };
const owner = { requestorId, role: 'Owner' };

const makeResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

const setupHistoryQuery = (posts = [], total = posts.length) => {
  const query = {
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(posts),
  };
  XScheduledPost.find.mockReturnValue(query);
  XScheduledPost.countDocuments.mockResolvedValue(total);
  return query;
};

const getHistory = async (query, requestor = permissionHolder) => {
  const res = makeResponse();
  await controller.getHistory({ body: { requestor }, query }, res);
  return res;
};

const expectNoXPostOperations = () => {
  Object.values(XScheduledPost).forEach((operation) => expect(operation).not.toHaveBeenCalled());
};

describe('xPostController authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test.each([
    ['missing requestor', {}],
    ['missing requestorId', { requestor: { role: 'Volunteer' } }],
  ])('returns 401 with no X post operation for %s', async (_, body) => {
    const res = makeResponse();

    await controller.createPost({ body }, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(hasPermission).not.toHaveBeenCalled();
    expectNoXPostOperations();
  });

  test('returns 403 with no X post operation when sendEmails is denied', async () => {
    hasPermission.mockResolvedValue(false);
    const res = makeResponse();

    await controller.createPost(
      { body: { content: 'Not authorized', requestor: permissionHolder } },
      res,
    );

    expect(hasPermission).toHaveBeenCalledWith(permissionHolder, 'sendEmails');
    expect(res.status).toHaveBeenCalledWith(403);
    expectNoXPostOperations();
  });

  test.each([
    ['schedulePost', controller.schedulePost, { scheduledAt: '2099-01-01T00:00:00.000Z' }],
    ['getScheduled', controller.getScheduled, {}],
    ['deleteScheduled', controller.deleteScheduled, {}],
    ['getHistory', controller.getHistory, {}],
    ['markAsPosted', controller.markAsPosted, {}],
    ['updateScheduledPost', controller.updateScheduledPost, {}],
    ['skipPost', controller.skipPost, {}],
  ])('%s performs no X post operation when authorization returns 403', async (_, action, body) => {
    hasPermission.mockResolvedValue(false);
    const res = makeResponse();

    await action(
      {
        body: { ...body, requestor: permissionHolder },
        params: { id: 'post-id' },
        query: {},
      },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expectNoXPostOperations();
  });

  test.each([
    ['getScheduled', controller.getScheduled],
    ['deleteScheduled', controller.deleteScheduled],
    ['getHistory', controller.getHistory],
    ['markAsPosted', controller.markAsPosted],
    ['updateScheduledPost', controller.updateScheduledPost],
    ['skipPost', controller.skipPost],
  ])('%s performs no X post operation when requestor is missing', async (_, action) => {
    const res = makeResponse();

    await action({ body: {}, params: { id: 'post-id' }, query: {} }, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(hasPermission).not.toHaveBeenCalled();
    expectNoXPostOperations();
  });

  test.each(['Owner', 'Administrator'])(
    '%s bypasses hasPermission while retaining createdBy',
    async (role) => {
      XScheduledPost.create.mockResolvedValue({ _id: 'post-id' });
      const elevatedRequestor = { requestorId, role };
      const res = makeResponse();

      await controller.createPost(
        { body: { content: 'Elevated post', requestor: elevatedRequestor } },
        res,
      );

      expect(hasPermission).not.toHaveBeenCalled();
      expect(XScheduledPost.create).toHaveBeenCalledWith(
        expect.objectContaining({ createdBy: requestorId }),
      );
      expect(res.status).toHaveBeenCalledWith(201);
    },
  );
});

describe('xPostController creation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    hasPermission.mockResolvedValue(true);
  });

  test('stages an immediate post as ready without marking it posted', async () => {
    XScheduledPost.create.mockResolvedValue({ _id: 'post-id' });
    const req = {
      body: {
        content: 'Immediate X post',
        requestor: { requestorId },
      },
    };
    const res = makeResponse();

    await controller.createPost(req, res);

    const createdPost = XScheduledPost.create.mock.calls[0][0];
    expect(createdPost).toEqual({
      content: 'Immediate X post',
      scheduledAt: expect.any(Date),
      status: 'ready',
      createdBy: requestorId,
    });
    expect(createdPost.status).not.toBe('posted');
    expect(createdPost).not.toHaveProperty('postedAt');
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('persists the authenticated requestor as the creator of a scheduled post', async () => {
    const scheduledRequestorId = '64b7f94e12c9a93bf4a83962';
    const scheduledAt = new Date(Date.now() + 60_000).toISOString();
    XScheduledPost.create.mockResolvedValue({ _id: 'scheduled-post-id' });
    const req = {
      body: {
        content: 'Scheduled X post',
        scheduledAt,
        requestor: { requestorId: scheduledRequestorId },
      },
    };
    const res = makeResponse();

    await controller.schedulePost(req, res);

    expect(XScheduledPost.create).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'Scheduled X post',
        scheduledAt: new Date(scheduledAt),
        createdBy: scheduledRequestorId,
      }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe('xPostController.markAsPosted', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    hasPermission.mockResolvedValue(true);
  });

  test('explicitly marks a staged post as posted and assigns postedAt', async () => {
    const updatedPost = { _id: 'post-id', status: 'posted' };
    XScheduledPost.findOneAndUpdate.mockResolvedValue(updatedPost);
    const res = makeResponse();

    await controller.markAsPosted(
      { body: { requestor: permissionHolder }, params: { id: 'post-id' } },
      res,
    );

    expect(XScheduledPost.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'post-id', createdBy: requestorId },
      { status: 'posted', postedAt: expect.any(Date) },
      { new: true },
    );
    expect(res.json).toHaveBeenCalledWith(updatedPost);
  });

  test("does not mark another user's post as posted", async () => {
    XScheduledPost.findOneAndUpdate.mockResolvedValue(null);
    const res = makeResponse();

    await controller.markAsPosted(
      { body: { requestor: permissionHolder }, params: { id: 'other-post' } },
      res,
    );

    expect(XScheduledPost.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'other-post', createdBy: requestorId },
      { status: 'posted', postedAt: expect.any(Date) },
      { new: true },
    );
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).not.toHaveBeenCalledWith(expect.objectContaining({ status: 'posted' }));
  });

  test('uses an unscoped ID selector for an elevated requestor', async () => {
    XScheduledPost.findOneAndUpdate.mockResolvedValue({ _id: 'other-post', status: 'posted' });

    await controller.markAsPosted(
      { body: { requestor: owner }, params: { id: 'other-post' } },
      makeResponse(),
    );

    expect(hasPermission).not.toHaveBeenCalled();
    expect(XScheduledPost.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'other-post' },
      { status: 'posted', postedAt: expect.any(Date) },
      { new: true },
    );
  });
});

describe('xPostController requestor-owned mutations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    hasPermission.mockResolvedValue(true);
  });

  test('deletes through a requestor-owned selector', async () => {
    XScheduledPost.findOneAndDelete.mockResolvedValue({ _id: 'post-id' });
    const res = makeResponse();

    await controller.deleteScheduled(
      { body: { requestor: permissionHolder }, params: { id: 'post-id' } },
      res,
    );

    expect(XScheduledPost.findOneAndDelete).toHaveBeenCalledWith({
      _id: 'post-id',
      createdBy: requestorId,
    });
    expect(res.json).toHaveBeenCalledWith({ message: 'Scheduled post cancelled' });
  });

  test("cannot delete another user's post", async () => {
    XScheduledPost.findOneAndDelete.mockResolvedValue(null);
    const res = makeResponse();

    await controller.deleteScheduled(
      { body: { requestor: permissionHolder }, params: { id: 'other-post' } },
      res,
    );

    expect(XScheduledPost.findOneAndDelete).toHaveBeenCalledWith({
      _id: 'other-post',
      createdBy: requestorId,
    });
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('updates through a requestor-owned selector and preserves the save flow', async () => {
    const doc = { status: 'pending', content: 'Before', save: jest.fn().mockResolvedValue() };
    XScheduledPost.findOne.mockResolvedValue(doc);
    const res = makeResponse();

    await controller.updateScheduledPost(
      {
        body: { requestor: permissionHolder, content: 'After' },
        params: { id: 'post-id' },
      },
      res,
    );

    expect(XScheduledPost.findOne).toHaveBeenCalledWith({
      _id: 'post-id',
      createdBy: requestorId,
    });
    expect(doc.content).toBe('After');
    expect(doc.save).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith(doc);
  });

  test("does not save when another user's PUT record is not found", async () => {
    const save = jest.fn();
    XScheduledPost.findOne.mockResolvedValue(null);
    const res = makeResponse();

    await controller.updateScheduledPost(
      {
        body: { requestor: permissionHolder, content: 'Unauthorized update' },
        params: { id: 'other-post' },
      },
      res,
    );

    expect(XScheduledPost.findOne).toHaveBeenCalledWith({
      _id: 'other-post',
      createdBy: requestorId,
    });
    expect(save).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('skips through a requestor-owned selector', async () => {
    XScheduledPost.findOneAndUpdate.mockResolvedValue({ _id: 'post-id', status: 'skipped' });

    await controller.skipPost(
      { body: { requestor: permissionHolder }, params: { id: 'post-id' } },
      makeResponse(),
    );

    expect(XScheduledPost.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'post-id', createdBy: requestorId },
      { status: 'skipped' },
      { new: true },
    );
  });

  test("cannot skip another user's post", async () => {
    XScheduledPost.findOneAndUpdate.mockResolvedValue(null);
    const res = makeResponse();

    await controller.skipPost(
      { body: { requestor: permissionHolder }, params: { id: 'other-post' } },
      res,
    );

    expect(XScheduledPost.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'other-post', createdBy: requestorId },
      { status: 'skipped' },
      { new: true },
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test.each([
    ['delete', 'findOneAndDelete'],
    ['update', 'findOne'],
  ])('uses an unscoped ID selector for elevated %s', async (operation, modelMethod) => {
    if (operation === 'delete') {
      XScheduledPost.findOneAndDelete.mockResolvedValue({ _id: 'other-post' });
      await controller.deleteScheduled(
        { body: { requestor: owner }, params: { id: 'other-post' } },
        makeResponse(),
      );
    } else {
      const doc = { status: 'ready', save: jest.fn().mockResolvedValue() };
      XScheduledPost.findOne.mockResolvedValue(doc);
      await controller.updateScheduledPost(
        { body: { requestor: owner }, params: { id: 'other-post' } },
        makeResponse(),
      );
    }

    expect(hasPermission).not.toHaveBeenCalled();
    expect(XScheduledPost[modelMethod]).toHaveBeenCalledWith({ _id: 'other-post' });
  });
});

describe('xPostController.getScheduled', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    hasPermission.mockResolvedValue(true);
  });

  test('returns pending, ready, and skipped posts in schedule order without including posted', async () => {
    const posts = [
      { _id: 'pending-post', status: 'pending' },
      { _id: 'ready-post', status: 'ready' },
      { _id: 'skipped-post', status: 'skipped' },
    ];
    const query = {
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(posts),
    };
    XScheduledPost.find.mockReturnValue(query);
    const res = makeResponse();

    await controller.getScheduled({ body: { requestor: owner } }, res);

    expect(XScheduledPost.find).toHaveBeenCalledWith({
      status: { $in: ['pending', 'ready', 'skipped'] },
    });
    expect(query.sort).toHaveBeenCalledWith({ scheduledAt: 1 });
    expect(res.json).toHaveBeenCalledWith(posts);
    expect(XScheduledPost.find.mock.calls[0][0].status.$in).not.toContain('posted');
    expect(hasPermission).not.toHaveBeenCalled();
  });

  test('scopes scheduled posts to a non-elevated permission holder', async () => {
    const query = {
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    };
    XScheduledPost.find.mockReturnValue(query);

    await controller.getScheduled({ body: { requestor: permissionHolder } }, makeResponse());

    expect(XScheduledPost.find).toHaveBeenCalledWith({
      status: { $in: ['pending', 'ready', 'skipped'] },
      createdBy: requestorId,
    });
  });
});

describe('xPostController.getHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    hasPermission.mockResolvedValue(true);
  });

  test('returns posts and the full matching total while applying a valid limit', async () => {
    const posts = [{ _id: 'post-1' }, { _id: 'post-2' }];
    const query = setupHistoryQuery(posts, 37);

    const res = await getHistory({ limit: '20' });

    const requestorPostedFilter = { ...postedFilter, createdBy: requestorId };
    expect(XScheduledPost.find).toHaveBeenCalledWith(requestorPostedFilter);
    expect(query.sort).toHaveBeenCalledWith({ postedAt: -1 });
    expect(query.limit).toHaveBeenCalledWith(20);
    expect(XScheduledPost.countDocuments).toHaveBeenCalledWith(requestorPostedFilter);
    expect(res.json).toHaveBeenCalledWith({ posts, total: 37 });
  });

  test('returns all matching posts when limit is missing', async () => {
    const posts = [{ _id: 'post-1' }];
    const query = setupHistoryQuery(posts, 1);

    const res = await getHistory({});

    expect(query.limit).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ posts, total: 1 });
  });

  test.each(['invalid', '1.5', '0', '-1'])(
    'ignores an invalid or non-positive limit: %s',
    async (limit) => {
      const query = setupHistoryQuery([], 0);

      await getHistory({ limit });

      expect(query.limit).not.toHaveBeenCalled();
    },
  );

  test('ignores an array-valued limit', async () => {
    const query = setupHistoryQuery([], 0);

    await getHistory({ limit: ['20', '30'] });

    expect(query.limit).not.toHaveBeenCalled();
  });

  test('ignores a limit larger than Number.MAX_SAFE_INTEGER', async () => {
    const query = setupHistoryQuery([], 0);

    await getHistory({ limit: String(Number.MAX_SAFE_INTEGER + 1) });

    expect(query.limit).not.toHaveBeenCalled();
  });

  test.each(['Owner', 'Administrator'])(
    'uses the unscoped posted filter for privileged %s history',
    async (role) => {
      setupHistoryQuery([], 0);

      await getHistory({}, { requestorId, role });

      expect(hasPermission).not.toHaveBeenCalled();
      expect(XScheduledPost.find).toHaveBeenCalledWith(postedFilter);
      expect(XScheduledPost.countDocuments).toHaveBeenCalledWith(postedFilter);
    },
  );
});
