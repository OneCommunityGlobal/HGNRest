jest.mock('../../../startup/logger', () => ({ logException: jest.fn() }));
const factory = require('../bmNewLessonController');
const logger = require('../../../startup/logger');

describe('bmGetLessonList database query orchestration', () => {
  let model;
  let controller;
  let req;
  let res;
  let query;
  let countQuery;
  const records = [
    { _id: 'lesson-id', author: 'author-id', relatedProject: 'project-id', files: [], tags: [] },
  ];
  beforeEach(() => {
    jest.clearAllMocks();
    query = Promise.resolve(records);
    ['sort', 'skip', 'limit', 'collation', 'allowDiskUse'].forEach((name) => {
      query[name] = jest.fn(() => query);
    });
    countQuery = Promise.resolve(7);
    countQuery.collation = jest.fn(() => countQuery);
    model = {
      find: jest.fn(() => query),
      countDocuments: jest.fn(() => countQuery),
      aggregate: jest.fn(() => query),
      hydrate: jest.fn((doc) => doc),
      collection: { name: 'buildingNewLessons' },
    };
    controller = factory(model);
    req = { query: {} };
    res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
  });
  test('legacy request preserves document/reference fields and performs no count/sort', async () => {
    await controller.bmGetLessonList(req, res);
    expect(model.find).toHaveBeenCalledWith({}, null, { collation: { locale: 'simple' } });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(records.map((doc) => ({ ...doc, isLiked: false })));
    expect(query.sort).not.toHaveBeenCalled();
    expect(model.countDocuments).not.toHaveBeenCalled();
    expect(model.aggregate).not.toHaveBeenCalled();
  });
  test('filters/sorts in MongoDB and counts only the matching filter for pagination', async () => {
    req.query = {
      tags: ['safety', 'concrete'],
      tagMatch: 'any',
      sort: 'likes',
      page: '2',
      limit: '3',
    };
    await controller.bmGetLessonList(req, res);
    const filter = { tags: { $in: ['safety', 'concrete'] } };
    expect(model.find).toHaveBeenCalledWith(filter, null, { collation: { locale: 'simple' } });
    expect(model.countDocuments).toHaveBeenCalledWith(filter);
    expect(countQuery.collation).toHaveBeenCalledWith({ locale: 'simple' });
    expect(query.sort).toHaveBeenCalledWith({ totalLikes: -1, _id: -1 });
    expect(query.skip).toHaveBeenCalledWith(3);
    expect(query.limit).toHaveBeenCalledWith(3);
    expect(res.send).toHaveBeenCalledWith({
      data: records.map((doc) => ({ ...doc, isLiked: false })),
      pagination: { page: 2, limit: 3, total: 7, totalPages: 3, hasNextPage: true },
    });
  });
  test('tag frequency uses one aggregate and hydrates without populating references', async () => {
    req.query = { tags: 'safety', sort: 'tagFrequency' };
    await controller.bmGetLessonList(req, res);
    expect(model.aggregate).toHaveBeenCalledTimes(1);
    expect(query.allowDiskUse).toHaveBeenCalledWith(true);
    expect(model.hydrate).toHaveBeenCalledWith(records[0]);
    expect(model.find).not.toHaveBeenCalled();
    expect(model.countDocuments).not.toHaveBeenCalled();
    expect(res.send).toHaveBeenCalledWith(records.map((doc) => ({ ...doc, isLiked: false })));
  });
  test('paginated global sort uses one aggregate and one matching count', async () => {
    req.query = { sort: 'tagFrequency', page: '1' };
    await controller.bmGetLessonList(req, res);
    expect(model.aggregate).toHaveBeenCalledTimes(1);
    expect(model.countDocuments).toHaveBeenCalledTimes(1);
  });
  test.each([{ tags: { $ne: '' } }, { sort: 'bad' }, { page: '1.5' }, { timeZone: 'unknown' }])(
    'rejects %p before database work',
    async (params) => {
      req.query = params;
      await controller.bmGetLessonList(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(model.find).not.toHaveBeenCalled();
      expect(model.aggregate).not.toHaveBeenCalled();
      expect(model.countDocuments).not.toHaveBeenCalled();
    },
  );
  test.each(['find', 'count', 'aggregate'])('safe 500 for a %s error', async (kind) => {
    const error = new Error('private database details');
    if (kind === 'aggregate') {
      req.query.sort = 'tagFrequency';
      model.aggregate.mockImplementation(() => {
        throw error;
      });
    } else if (kind === 'count') {
      req.query.page = '1';
      model.countDocuments.mockImplementation(() => {
        throw error;
      });
    } else model.find.mockRejectedValue(error);
    await controller.bmGetLessonList(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith({ error: 'Failed to fetch lessons.' });
    expect(logger.logException).toHaveBeenCalledWith(error, 'bmGetLessonList');
  });
});
