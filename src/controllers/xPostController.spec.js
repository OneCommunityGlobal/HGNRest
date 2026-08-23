jest.mock('../models/xScheduledPost', () => ({
  create: jest.fn(),
  find: jest.fn(),
  countDocuments: jest.fn(),
}));

const XScheduledPost = require('../models/xScheduledPost');
const controller = require('./xPostController');

const postedFilter = { status: 'posted' };

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

const getHistory = async (query) => {
  const res = makeResponse();
  await controller.getHistory({ query }, res);
  return res;
};

describe('xPostController creation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('persists the authenticated requestor as the creator of an immediate post', async () => {
    const requestorId = '64b7f94e12c9a93bf4a83961';
    XScheduledPost.create.mockResolvedValue({ _id: 'post-id' });
    const req = {
      body: {
        content: 'Immediate X post',
        requestor: { requestorId },
      },
    };
    const res = makeResponse();

    await controller.createPost(req, res);

    expect(XScheduledPost.create).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'Immediate X post',
        status: 'posted',
        createdBy: requestorId,
      }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('persists the authenticated requestor as the creator of a scheduled post', async () => {
    const requestorId = '64b7f94e12c9a93bf4a83962';
    const scheduledAt = new Date(Date.now() + 60_000).toISOString();
    XScheduledPost.create.mockResolvedValue({ _id: 'scheduled-post-id' });
    const req = {
      body: {
        content: 'Scheduled X post',
        scheduledAt,
        requestor: { requestorId },
      },
    };
    const res = makeResponse();

    await controller.schedulePost(req, res);

    expect(XScheduledPost.create).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'Scheduled X post',
        scheduledAt: new Date(scheduledAt),
        createdBy: requestorId,
      }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe('xPostController.getScheduled', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

    await controller.getScheduled({}, res);

    expect(XScheduledPost.find).toHaveBeenCalledWith({
      status: { $in: ['pending', 'ready', 'skipped'] },
    });
    expect(query.sort).toHaveBeenCalledWith({ scheduledAt: 1 });
    expect(res.json).toHaveBeenCalledWith(posts);
    expect(XScheduledPost.find.mock.calls[0][0].status.$in).not.toContain('posted');
  });
});

describe('xPostController.getHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns posts and the full matching total while applying a valid limit', async () => {
    const posts = [{ _id: 'post-1' }, { _id: 'post-2' }];
    const query = setupHistoryQuery(posts, 37);

    const res = await getHistory({ limit: '20' });

    expect(XScheduledPost.find).toHaveBeenCalledWith(postedFilter);
    expect(query.sort).toHaveBeenCalledWith({ postedAt: -1 });
    expect(query.limit).toHaveBeenCalledWith(20);
    expect(XScheduledPost.countDocuments).toHaveBeenCalledWith(postedFilter);
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
});
