jest.mock('../../../startup/logger', () => ({ logException: jest.fn() }));
const factory = require('../bmNewLessonController');
const logger = require('../../../startup/logger');

describe('getLessonTagCounts', () => {
  let model;
  let controller;
  let res;
  let query;
  beforeEach(() => {
    jest.clearAllMocks();
    query = Promise.resolve([{ tag: 'Safety', count: 42 }]);
    query.collation = jest.fn(() => query);
    query.allowDiskUse = jest.fn(() => query);
    model = { aggregate: jest.fn(() => query), find: jest.fn() };
    controller = factory(model);
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  });
  test('aggregates all occurrences with a tags-only projection and deterministic order', async () => {
    await controller.getLessonTagCounts({ query: { tags: 'ignored' } }, res);
    expect(model.aggregate).toHaveBeenCalledTimes(1);
    expect(model.aggregate).toHaveBeenCalledWith([
      { $project: { tags: 1, _id: 0 } },
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $project: { _id: 0, tag: '$_id', count: 1 } },
      { $sort: { count: -1, tag: 1 } },
    ]);
    expect(query.collation).toHaveBeenCalledWith({ locale: 'simple' });
    expect(query.allowDiskUse).toHaveBeenCalledWith(true);
    expect(model.find).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([{ tag: 'Safety', count: 42 }]);
  });
  test('asynchronous database errors are logged and hidden from clients', async () => {
    const error = new Error('private database details');
    model.aggregate.mockReturnValue({
      collation: () => ({ allowDiskUse: () => Promise.reject(error) }),
    });
    await controller.getLessonTagCounts({}, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch lesson tag counts.' });
    expect(logger.logException).toHaveBeenCalledWith(error, 'getLessonTagCounts');
  });
});
