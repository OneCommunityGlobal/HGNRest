jest.mock('../models/xScheduledPost', () => ({
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
