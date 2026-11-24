jest.mock('../../models/lessonPlan', () => {
  const Model = jest.fn();
  Model.find = jest.fn();
  Model.findById = jest.fn();
  Model.findByIdAndDelete = jest.fn();
  return Model;
});
jest.mock('../../models/activity', () => ({ deleteMany: jest.fn() }));

const LessonPlan = require('../../models/lessonPlan');
const Activity = require('../../models/activity');
const lessonPlanController = require('../lessonPlanController')();

const response = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
});

const listQuery = (result) => ({
  populate: jest.fn().mockReturnThis(),
  sort: jest.fn().mockResolvedValue(result),
});

const awaitableQuery = (getResult) => ({
  populate: jest.fn().mockReturnThis(),
  then: (resolve, reject) => Promise.resolve().then(getResult).then(resolve, reject),
});

const planId = '507f1f77bcf86cd799439011';
const plan = { _id: planId, title: 'Plan' };

afterEach(() => {
  jest.clearAllMocks();
});

describe('lesson-plan read handlers', () => {
  test('returns all lesson plans with populated fields and descending creation order', async () => {
    const records = [plan];
    const query = listQuery(records);
    LessonPlan.find.mockReturnValue(query);
    const res = response();

    await lessonPlanController.getLessonPlans({}, res);

    expect(LessonPlan.find).toHaveBeenCalledWith({});
    expect(query.populate).toHaveBeenNthCalledWith(1, 'createdBy', 'firstName lastName email');
    expect(query.populate).toHaveBeenNthCalledWith(2, 'activities', 'title description');
    expect(query.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(records);
  });

  test('returns a server error when listing lesson plans fails', async () => {
    LessonPlan.find.mockImplementation(() => {
      throw new Error('list failed');
    });
    const res = response();

    await lessonPlanController.getLessonPlans({}, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'list failed' });
  });

  test('returns lesson plans for a creator', async () => {
    const query = listQuery([plan]);
    LessonPlan.find.mockReturnValue(query);
    const res = response();

    await lessonPlanController.getLessonPlansByCreator({ params: { creatorId: planId } }, res);

    expect(LessonPlan.find).toHaveBeenCalledWith({ createdBy: planId });
    expect(query.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([plan]);
  });

  test('returns a server error when creator lookup fails', async () => {
    LessonPlan.find.mockImplementation(() => {
      throw new Error('creator lookup failed');
    });
    const res = response();

    await lessonPlanController.getLessonPlansByCreator({ params: { creatorId: planId } }, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'creator lookup failed' });
  });

  test('returns a lesson plan by ID with nested activity population', async () => {
    const query = awaitableQuery(() => plan);
    LessonPlan.findById.mockReturnValue(query);
    const res = response();

    await lessonPlanController.getLessonPlanById({ params: { id: planId } }, res);

    expect(LessonPlan.findById).toHaveBeenCalledWith(planId);
    expect(query.populate).toHaveBeenNthCalledWith(2, {
      path: 'activities',
      populate: {
        path: 'atomTaskTemplates.atomId',
        select: 'name description difficulty',
      },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(plan);
  });

  test('returns 404 when a lesson plan ID is not found', async () => {
    LessonPlan.findById.mockReturnValue(awaitableQuery(() => null));
    const res = response();

    await lessonPlanController.getLessonPlanById({ params: { id: planId } }, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Lesson plan not found' });
  });

  test('returns a server error when lesson-plan lookup fails', async () => {
    LessonPlan.findById.mockReturnValue(
      awaitableQuery(() => {
        throw new Error('lookup failed');
      }),
    );
    const res = response();

    await lessonPlanController.getLessonPlanById({ params: { id: planId } }, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'lookup failed' });
  });
});

describe('lesson-plan deletion', () => {
  test('deletes associated activities and the lesson plan', async () => {
    LessonPlan.findById.mockResolvedValue(plan);
    Activity.deleteMany.mockResolvedValue({ deletedCount: 1 });
    LessonPlan.findByIdAndDelete.mockResolvedValue(plan);
    const res = response();

    await lessonPlanController.deleteLessonPlan({ params: { id: planId } }, res);

    expect(Activity.deleteMany).toHaveBeenCalledWith({ lessonPlanId: planId });
    expect(LessonPlan.findByIdAndDelete).toHaveBeenCalledWith(planId);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Lesson plan deleted successfully' });
  });

  test('returns 404 and does not delete when the plan is missing', async () => {
    LessonPlan.findById.mockResolvedValue(null);
    const res = response();

    await lessonPlanController.deleteLessonPlan({ params: { id: planId } }, res);

    expect(Activity.deleteMany).not.toHaveBeenCalled();
    expect(LessonPlan.findByIdAndDelete).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns a server error when deletion fails', async () => {
    LessonPlan.findById.mockResolvedValue(plan);
    Activity.deleteMany.mockRejectedValue(new Error('delete failed'));
    const res = response();

    await lessonPlanController.deleteLessonPlan({ params: { id: planId } }, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'delete failed' });
  });
});

describe('lesson-plan date and theme queries', () => {
  test.each([
    [
      { startDate: '2030-01-01', endDate: '2030-02-01' },
      {
        startDate: { $gte: new Date('2030-01-01') },
        endDate: { $lte: new Date('2030-02-01') },
      },
    ],
    [{ startDate: '2030-01-01' }, { startDate: { $gte: new Date('2030-01-01') } }],
    [{ endDate: '2030-02-01' }, { endDate: { $lte: new Date('2030-02-01') } }],
    [{}, {}],
  ])('uses the requested date-range filters %#', async (queryParams, expectedFilter) => {
    const query = listQuery([plan]);
    LessonPlan.find.mockReturnValue(query);
    const res = response();

    await lessonPlanController.getLessonPlansByDateRange({ query: queryParams }, res);

    expect(LessonPlan.find).toHaveBeenCalledWith(expectedFilter);
    expect(query.sort).toHaveBeenCalledWith({ startDate: 1 });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([plan]);
  });

  test('returns a server error when date-range lookup fails', async () => {
    LessonPlan.find.mockImplementation(() => {
      throw new Error('date lookup failed');
    });
    const res = response();

    await lessonPlanController.getLessonPlansByDateRange({ query: {} }, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'date lookup failed' });
  });

  test('returns lesson plans for a theme', async () => {
    const query = listQuery([plan]);
    LessonPlan.find.mockReturnValue(query);
    const res = response();

    await lessonPlanController.getLessonPlansByTheme({ params: { theme: 'Science' } }, res);

    expect(LessonPlan.find).toHaveBeenCalledWith({ theme: 'Science' });
    expect(query.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('returns a server error when theme lookup fails', async () => {
    LessonPlan.find.mockImplementation(() => {
      throw new Error('theme lookup failed');
    });
    const res = response();

    await lessonPlanController.getLessonPlansByTheme({ params: { theme: 'Science' } }, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'theme lookup failed' });
  });
});
