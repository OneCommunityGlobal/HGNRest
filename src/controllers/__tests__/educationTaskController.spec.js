const mongoose = require('mongoose');

/* =======================
   MOCKS (MUST COME FIRST)
   ======================= */

jest.mock('../../models/educationTask', () => ({
  find: jest.fn(),
  findById: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn(),
  insertMany: jest.fn(),
}));

jest.mock('../../models/lessonPlan', () => ({
  findById: jest.fn(),
}));

jest.mock('../../models/userProfile', () => ({
  findById: jest.fn(),
}));

jest.mock('../../models/atom', () => ({
  find: jest.fn(),
}));

jest.mock('../../models/studentGroup', () => ({
  findById: jest.fn(),
}));

jest.mock('../../models/studentGroupMember', () => ({
  find: jest.fn(),
}));

jest.mock('../../models/intermediateTask', () => ({}));

/* =======================
   IMPORTS AFTER MOCKS
   ======================= */

const EducationTask = require('../../models/educationTask');
const LessonPlan = require('../../models/lessonPlan');
const UserProfile = require('../../models/userProfile');
const Atom = require('../../models/atom');
const StudentGroup = require('../../models/studentGroup');
const StudentGroupMember = require('../../models/studentGroupMember');
const educationTaskControllerFactory = require('../educationTaskController');

const controller = educationTaskControllerFactory();

/* =======================
   TEST HELPERS
   ======================= */

// Mongoose query-chain mock: awaitable, and supports chained
// .populate()/.sort()/.select() calls that return the same chain.
const makeChain = (result) => {
  const promise = Promise.resolve(result);
  promise.populate = jest.fn(() => promise);
  promise.sort = jest.fn(() => promise);
  promise.allowDiskUse = jest.fn(() => promise);
  promise.select = jest.fn(() => promise);
  return promise;
};

const mockRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

beforeEach(() => {
  jest.clearAllMocks();
});

/* =======================
   TESTS
   ======================= */

describe('getEducationTasks', () => {
  test('returns 200 with the task list', async () => {
    const query = makeChain([{ _id: '1' }]);
    EducationTask.find.mockReturnValue(query);
    const res = mockRes();

    await controller.getEducationTasks({}, res);

    expect(EducationTask.find).toHaveBeenCalledWith({});
    expect(query.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(query.allowDiskUse).toHaveBeenCalledWith(true);
    expect(query.populate).toHaveBeenCalledWith('lessonPlanId', 'title theme');
    expect(query.populate).toHaveBeenCalledWith('studentId', 'firstName lastName email');
    expect(query.populate).toHaveBeenCalledWith('atomIds', 'name description difficulty');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([{ _id: '1' }]);
  });

  test('returns 500 on database error', async () => {
    EducationTask.find.mockImplementation(() => {
      throw new Error('db down');
    });
    const res = mockRes();

    await controller.getEducationTasks({}, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('getTasksByStudent', () => {
  test('queries by studentId param', async () => {
    EducationTask.find.mockReturnValue(makeChain([]));
    const res = mockRes();

    await controller.getTasksByStudent({ params: { studentId: 'abc' } }, res);

    expect(EducationTask.find).toHaveBeenCalledWith({ studentId: 'abc' });
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('getTasksByLessonPlan', () => {
  test('queries by lessonPlanId param', async () => {
    EducationTask.find.mockReturnValue(makeChain([]));
    const res = mockRes();

    await controller.getTasksByLessonPlan({ params: { lessonPlanId: 'lp1' } }, res);

    expect(EducationTask.find).toHaveBeenCalledWith({ lessonPlanId: 'lp1' });
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('getTaskById', () => {
  test('returns 404 when task not found', async () => {
    EducationTask.findById.mockReturnValue(makeChain(null));
    const res = mockRes();

    await controller.getTaskById({ params: { id: 'missing' } }, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns 200 with the task', async () => {
    EducationTask.findById.mockReturnValue(makeChain({ _id: 'x' }));
    const res = mockRes();

    await controller.getTaskById({ params: { id: 'x' } }, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ _id: 'x' });
  });
});

describe('createTask', () => {
  const baseBody = {
    name: 'TEST - Student Tasks PR 4210',
    suggestedTotalHours: 5,
    lessonPlanId: 'lp1',
    type: 'read',
    dueAt: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 404 when lesson plan does not exist', async () => {
    LessonPlan.findById.mockResolvedValue(null);
    const res = mockRes();

    await controller.createTask({ body: { ...baseBody, studentId: 's1' } }, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns 400 for an invalid task type', async () => {
    LessonPlan.findById.mockResolvedValue({ _id: 'lp1' });
    const res = mockRes();

    await controller.createTask(
      { body: { ...baseBody, type: 'not-a-type', studentId: 's1' } },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns 400 when neither studentId nor groupId is provided', async () => {
    LessonPlan.findById.mockResolvedValue({ _id: 'lp1' });
    const res = mockRes();

    await controller.createTask({ body: { ...baseBody } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns 404 when the target student does not exist', async () => {
    LessonPlan.findById.mockResolvedValue({ _id: 'lp1' });
    UserProfile.findById.mockResolvedValue(null);
    const res = mockRes();

    await controller.createTask({ body: { ...baseBody, studentId: 's1' } }, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns 400 when one or more atoms are invalid', async () => {
    LessonPlan.findById.mockResolvedValue({ _id: 'lp1' });
    UserProfile.findById.mockResolvedValue({ _id: 's1' });
    Atom.find.mockResolvedValue([]);
    const res = mockRes();

    await controller.createTask(
      { body: { ...baseBody, studentId: 's1', atomIds: ['a1', 'a2'] } },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('creates a task for a single student', async () => {
    LessonPlan.findById.mockResolvedValue({ _id: 'lp1' });
    UserProfile.findById.mockResolvedValue({ _id: 's1' });
    EducationTask.insertMany.mockResolvedValue([{ _id: 't1' }]);
    EducationTask.find.mockReturnValue(makeChain([{ _id: 't1' }]));
    const res = mockRes();

    await controller.createTask(
      {
        body: {
          ...baseBody,
          name: `  ${baseBody.name}  `,
          loggedHours: 99,
          studentId: 's1',
        },
      },
      res,
    );

    expect(EducationTask.insertMany).toHaveBeenCalledWith([
      expect.objectContaining({
        name: baseBody.name,
        suggestedTotalHours: 5,
        loggedHours: 0,
        status: 'assigned',
        type: 'read',
        studentId: 's1',
        lessonPlanId: baseBody.lessonPlanId,
        dueAt: baseBody.dueAt,
      }),
    ]);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Tasks created successfully',
      tasks: [{ _id: 't1' }],
      group_name: null,
    });
  });

  test.each([undefined, null, '', '   ', 123])(
    'rejects invalid name %s before inserting',
    async (name) => {
      const res = mockRes();
      await controller.createTask({ body: { ...baseBody, name, studentId: 's1' } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'name must be a nonempty string' });
      expect(EducationTask.insertMany).not.toHaveBeenCalled();
    },
  );

  test.each([-1, Infinity, NaN, '5', null])(
    'rejects invalid suggested hours %s',
    async (suggestedTotalHours) => {
      const res = mockRes();
      await controller.createTask(
        { body: { ...baseBody, suggestedTotalHours, studentId: 's1' } },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(400);
      expect(EducationTask.insertMany).not.toHaveBeenCalled();
    },
  );

  test('creates tasks for an entire group', async () => {
    const groupId = new mongoose.Types.ObjectId().toString();
    LessonPlan.findById.mockResolvedValue({ _id: 'lp1' });
    StudentGroup.findById.mockResolvedValue({
      _id: groupId,
      name: 'Group A',
      educator_id: { toString: () => 'educator1' },
    });
    StudentGroupMember.find.mockReturnValue({
      select: jest.fn().mockResolvedValue([{ student_id: 's1' }, { student_id: 's2' }]),
    });
    EducationTask.insertMany.mockResolvedValue([{ _id: 't1' }, { _id: 't2' }]);
    EducationTask.find.mockReturnValue(makeChain([{ _id: 't1' }, { _id: 't2' }]));
    const res = mockRes();

    await controller.createTask({ body: { ...baseBody, groupId }, user: 'educator1' }, res);

    expect(EducationTask.insertMany).toHaveBeenCalledWith(
      ['s1', 's2'].map((studentId) =>
        expect.objectContaining({
          name: baseBody.name,
          suggestedTotalHours: 5,
          loggedHours: 0,
          studentId,
        }),
      ),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('returns 500 on unexpected error', async () => {
    LessonPlan.findById.mockRejectedValue(new Error('boom'));
    const res = mockRes();

    await controller.createTask({ body: { ...baseBody, studentId: 's1' } }, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  test('returns 400 for a malformed groupId', async () => {
    LessonPlan.findById.mockResolvedValue({ _id: 'lp1' });
    const res = mockRes();

    await controller.createTask({ body: { ...baseBody, groupId: 'not-an-id' } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns 404 when the group does not exist', async () => {
    const groupId = new mongoose.Types.ObjectId().toString();
    LessonPlan.findById.mockResolvedValue({ _id: 'lp1' });
    StudentGroup.findById.mockResolvedValue(null);
    const res = mockRes();

    await controller.createTask({ body: { ...baseBody, groupId } }, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns 403 when the requesting user does not own the group', async () => {
    const groupId = new mongoose.Types.ObjectId().toString();
    LessonPlan.findById.mockResolvedValue({ _id: 'lp1' });
    StudentGroup.findById.mockResolvedValue({
      _id: groupId,
      name: 'Group A',
      educator_id: { toString: () => 'someone-else' },
    });
    const res = mockRes();

    await controller.createTask({ body: { ...baseBody, groupId }, user: 'educator1' }, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('returns 400 when the group has no members', async () => {
    const groupId = new mongoose.Types.ObjectId().toString();
    LessonPlan.findById.mockResolvedValue({ _id: 'lp1' });
    StudentGroup.findById.mockResolvedValue({
      _id: groupId,
      name: 'Group A',
      educator_id: { toString: () => 'educator1' },
    });
    StudentGroupMember.find.mockReturnValue({
      select: jest.fn().mockResolvedValue([]),
    });
    const res = mockRes();

    await controller.createTask({ body: { ...baseBody, groupId }, user: 'educator1' }, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('updateTask', () => {
  test('returns 404 when task not found', async () => {
    EducationTask.findById.mockResolvedValue(null);
    const res = mockRes();

    await controller.updateTask(
      { params: { id: 'x' }, body: {}, user: { requestorId: 'test-admin-id', role: 'admin' } },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns 400 for an invalid status', async () => {
    EducationTask.findById.mockResolvedValue({ _id: 'x', status: 'assigned' });
    const res = mockRes();

    await controller.updateTask(
      {
        params: { id: 'x' },
        body: { status: 'bogus' },
        user: { requestorId: 'test-admin-id', role: 'admin' },
      },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('updates and returns the task', async () => {
    EducationTask.findById.mockResolvedValue({ _id: 'x', status: 'assigned' });
    EducationTask.findByIdAndUpdate.mockReturnValue(makeChain({ _id: 'x', status: 'completed' }));
    const res = mockRes();

    await controller.updateTask(
      {
        params: { id: 'x' },
        body: { status: 'completed' },
        user: { requestorId: 'test-admin-id', role: 'admin' },
      },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('deleteTask', () => {
  test('returns 404 when task not found', async () => {
    EducationTask.findByIdAndDelete.mockResolvedValue(null);
    const res = mockRes();

    await controller.deleteTask({ params: { id: 'x' } }, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('deletes the task', async () => {
    EducationTask.findByIdAndDelete.mockResolvedValue({ _id: 'x' });
    const res = mockRes();

    await controller.deleteTask({ params: { id: 'x' } }, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('updateTaskStatus', () => {
  test('returns 404 when task not found', async () => {
    EducationTask.findById.mockResolvedValue(null);
    const res = mockRes();

    await controller.updateTaskStatus({ params: { id: 'x' }, body: { status: 'completed' } }, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns 400 for an invalid status', async () => {
    EducationTask.findById.mockResolvedValue({ _id: 'x', status: 'assigned' });
    const res = mockRes();

    await controller.updateTaskStatus({ params: { id: 'x' }, body: { status: 'bogus' } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('marks status completed and stamps completedAt', async () => {
    EducationTask.findById.mockResolvedValue({ _id: 'x', status: 'assigned' });
    EducationTask.findByIdAndUpdate.mockReturnValue(makeChain({ _id: 'x', status: 'completed' }));
    const res = mockRes();

    await controller.updateTaskStatus({ params: { id: 'x' }, body: { status: 'completed' } }, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('gradeTask', () => {
  test('returns 404 when task not found', async () => {
    EducationTask.findById.mockResolvedValue(null);
    const res = mockRes();

    await controller.gradeTask({ params: { id: 'x' }, body: { grade: 'A' } }, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns 400 for an invalid grade', async () => {
    EducationTask.findById.mockResolvedValue({ _id: 'x' });
    const res = mockRes();

    await controller.gradeTask({ params: { id: 'x' }, body: { grade: 'Z' } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('grades the task', async () => {
    EducationTask.findById.mockResolvedValue({ _id: 'x' });
    EducationTask.findByIdAndUpdate.mockReturnValue(makeChain({ _id: 'x', grade: 'A' }));
    const res = mockRes();

    await controller.gradeTask({ params: { id: 'x' }, body: { grade: 'A' } }, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('markTaskAsComplete', () => {
  const taskId = '507f1f77bcf86cd799439011';
  const studentId = '65cf6c3706d8ac105827bb2e';
  const ownerFilter = {
    _id: new mongoose.Types.ObjectId(taskId),
    studentId: new mongoose.Types.ObjectId(studentId),
  };
  let req;
  let res;
  let task;

  beforeEach(() => {
    req = { user: { requestorId: studentId }, body: { taskId } };
    res = mockRes();
    task = { type: 'read', status: 'assigned', loggedHours: 5, suggestedTotalHours: 5 };
    EducationTask.findOne.mockReset().mockResolvedValue(task);
    EducationTask.findOneAndUpdate.mockReset().mockReturnValue(makeChain(null));
  });

  test('rejects missing authentication even with a client-provided identity', async () => {
    delete req.user;
    req.body.studentId = studentId;
    req.body.requestor = { requestorId: studentId };
    await controller.markTaskAsComplete(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(EducationTask.findOne).not.toHaveBeenCalled();
    expect(EducationTask.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test.each(['missing task', 'invalid task', 'invalid user'])('rejects %s', async (scenario) => {
    if (scenario === 'missing task') delete req.body.taskId;
    if (scenario === 'invalid task') req.body.taskId = 'bad';
    if (scenario === 'invalid user') req.user.requestorId = 'bad';
    await controller.markTaskAsComplete(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(EducationTask.findOne).not.toHaveBeenCalled();
    expect(EducationTask.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('ignores supplied studentId and refuses tasks not owned by the authenticated user', async () => {
    req.body.studentId = taskId;
    EducationTask.findOne.mockResolvedValue(null);
    await controller.markTaskAsComplete(req, res);
    expect(EducationTask.findOne).toHaveBeenCalledWith(ownerFilter);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(EducationTask.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test.each(['completed', 'graded'])('returns an owned %s task unchanged', async (status) => {
    task.status = status;
    task.type = 'write';
    await controller.markTaskAsComplete(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(task);
    expect(EducationTask.findOneAndUpdate).not.toHaveBeenCalled();
    expect(EducationTask.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test.each(['write', 'practice', 'quiz', 'project', undefined])(
    'does not bypass the completion workflow for type %s',
    async (type) => {
      task.type = type;
      task.uploadUrls = ['https://example.com/submission'];
      await controller.markTaskAsComplete(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(EducationTask.findOneAndUpdate).not.toHaveBeenCalled();
    },
  );

  test.each([
    [4, 5],
    [undefined, 5],
    [5, undefined],
    [null, 5],
    [5, null],
    [-1, 0],
    [5, -1],
    [NaN, 5],
    [5, NaN],
    [Infinity, 5],
    [5, Infinity],
    ['5', 5],
    [5, '5'],
  ])('rejects ineligible hours %s / %s', async (logged, suggested) => {
    task.loggedHours = logged;
    task.suggestedTotalHours = suggested;
    await controller.markTaskAsComplete(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(EducationTask.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test.each(['Assigned', 'pending', undefined])('rejects invalid status %s', async (status) => {
    task.status = status;
    await controller.markTaskAsComplete(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(EducationTask.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test.each([
    ['assigned', 5, 5],
    ['in_progress', 6, 5],
    ['assigned', 0, 0],
  ])(
    'atomically completes eligible %s task with %s / %s hours',
    async (status, logged, suggested) => {
      Object.assign(task, { status, loggedHours: logged, suggestedTotalHours: suggested });
      const updated = { ...task, status: 'completed', completedAt: new Date() };
      EducationTask.findOneAndUpdate.mockReturnValue(makeChain(updated));
      await controller.markTaskAsComplete(req, res);
      expect(EducationTask.findOne).toHaveBeenCalledWith(ownerFilter);
      expect(EducationTask.findOneAndUpdate).toHaveBeenCalledWith(
        {
          ...ownerFilter,
          type: 'read',
          status,
          loggedHours: logged,
          suggestedTotalHours: suggested,
        },
        { status: 'completed', completedAt: expect.any(Date) },
        { new: true, runValidators: true },
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(updated);
      expect(EducationTask.findByIdAndUpdate).not.toHaveBeenCalled();
    },
  );

  test('returns conflict when ownership, status, type or hours changed before update', async () => {
    await controller.markTaskAsComplete(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: 'Task changed; reload and retry completion' });
  });

  test('returns 500 on database failure', async () => {
    EducationTask.findOne.mockRejectedValue(new Error('db down'));
    await controller.markTaskAsComplete(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(EducationTask.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe('getTasksByStatus', () => {
  test('queries by status param', async () => {
    EducationTask.find.mockReturnValue(makeChain([]));
    const res = mockRes();

    await controller.getTasksByStatus({ params: { status: 'graded' } }, res);

    expect(EducationTask.find).toHaveBeenCalledWith({ status: 'graded' });
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('getSubmissionForReview', () => {
  test('returns 404 when submission not found', async () => {
    EducationTask.findById.mockReturnValue(makeChain(null));
    const res = mockRes();

    await controller.getSubmissionForReview({ params: { submissionId: 'x' } }, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns the submission', async () => {
    EducationTask.findById.mockReturnValue(makeChain({ _id: 'x' }));
    const res = mockRes();

    await controller.getSubmissionForReview({ params: { submissionId: 'x' } }, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('updateSubmissionGrade', () => {
  test('returns 404 when submission not found', async () => {
    EducationTask.findById.mockResolvedValue(null);
    const res = mockRes();

    await controller.updateSubmissionGrade(
      { params: { submissionId: 'x' }, body: { marks: 90, maxMarks: 100, action: 'update' } },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('computes a letter grade and saves a draft', async () => {
    EducationTask.findById.mockResolvedValue({ _id: 'x', marks: undefined, maxMarks: undefined });
    EducationTask.findByIdAndUpdate.mockReturnValue(makeChain({ _id: 'x', grade: 'A' }));
    const res = mockRes();

    await controller.updateSubmissionGrade(
      { params: { submissionId: 'x' }, body: { marks: 95, maxMarks: 100, action: 'update' } },
      res,
    );

    expect(EducationTask.findByIdAndUpdate).toHaveBeenCalledWith(
      'x',
      expect.objectContaining({ grade: 'A', submissionStatus: 'Grade Updated' }),
      expect.any(Object),
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('publishes a grade and marks the task graded', async () => {
    EducationTask.findById.mockResolvedValue({ _id: 'x', marks: undefined, maxMarks: undefined });
    EducationTask.findByIdAndUpdate.mockReturnValue(makeChain({ _id: 'x', grade: 'B' }));
    const res = mockRes();

    await controller.updateSubmissionGrade(
      {
        params: { submissionId: 'x' },
        body: { marks: 85, maxMarks: 100, action: 'publish', feedback: 'Nice work' },
      },
      res,
    );

    expect(EducationTask.findByIdAndUpdate).toHaveBeenCalledWith(
      'x',
      expect.objectContaining({
        grade: 'B',
        submissionStatus: 'Grade Posted',
        status: 'graded',
      }),
      expect.any(Object),
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('resolves educatorId from the requestor payload set by auth middleware', async () => {
    EducationTask.findById.mockResolvedValue({ _id: 'x' });
    EducationTask.findByIdAndUpdate.mockReturnValue(makeChain({ _id: 'x' }));
    const res = mockRes();

    await controller.updateSubmissionGrade(
      {
        params: { submissionId: 'x' },
        body: { feedback: 'ok', action: 'update', requestor: { requestorId: 'educator42' } },
      },
      res,
    );

    expect(EducationTask.findByIdAndUpdate).toHaveBeenCalledWith(
      'x',
      expect.objectContaining({ educatorId: 'educator42' }),
      expect.any(Object),
    );
  });

  test('returns 500 on unexpected error', async () => {
    EducationTask.findById.mockRejectedValue(new Error('db down'));
    const res = mockRes();

    await controller.updateSubmissionGrade({ params: { submissionId: 'x' }, body: {} }, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  test('does not compute a grade when marks are negative', async () => {
    EducationTask.findById.mockResolvedValue({ _id: 'x' });
    EducationTask.findByIdAndUpdate.mockReturnValue(makeChain({ _id: 'x' }));
    const res = mockRes();

    await controller.updateSubmissionGrade(
      { params: { submissionId: 'x' }, body: { marks: -5, maxMarks: 100, action: 'update' } },
      res,
    );

    expect(EducationTask.findByIdAndUpdate).toHaveBeenCalledWith(
      'x',
      expect.not.objectContaining({ grade: expect.anything() }),
      expect.any(Object),
    );
  });

  test('computes a numeric grade as a percentage when gradeType is numeric', async () => {
    EducationTask.findById.mockResolvedValue({ _id: 'x' });
    EducationTask.findByIdAndUpdate.mockReturnValue(makeChain({ _id: 'x' }));
    const res = mockRes();

    await controller.updateSubmissionGrade(
      {
        params: { submissionId: 'x' },
        body: { marks: 45, maxMarks: 50, gradeType: 'numeric', action: 'update' },
      },
      res,
    );

    expect(EducationTask.findByIdAndUpdate).toHaveBeenCalledWith(
      'x',
      expect.objectContaining({ grade: '90.00' }),
      expect.any(Object),
    );
  });

  test('applies a custom plain-object grade scale', async () => {
    EducationTask.findById.mockResolvedValue({ _id: 'x' });
    EducationTask.findByIdAndUpdate.mockReturnValue(makeChain({ _id: 'x' }));
    const res = mockRes();

    await controller.updateSubmissionGrade(
      {
        params: { submissionId: 'x' },
        body: {
          marks: 72,
          maxMarks: 100,
          action: 'update',
          gradeScale: { Excellent: 90, Pass: 70, Fail: 0 },
        },
      },
      res,
    );

    expect(EducationTask.findByIdAndUpdate).toHaveBeenCalledWith(
      'x',
      expect.objectContaining({ grade: 'Pass' }),
      expect.any(Object),
    );
  });

  test('applies a grade scale already stored as a Map on the task', async () => {
    EducationTask.findById.mockResolvedValue({
      _id: 'x',
      gradeScale: new Map([
        ['Excellent', 90],
        ['Pass', 70],
        ['Fail', 0],
      ]),
    });
    EducationTask.findByIdAndUpdate.mockReturnValue(makeChain({ _id: 'x' }));
    const res = mockRes();

    await controller.updateSubmissionGrade(
      { params: { submissionId: 'x' }, body: { marks: 95, maxMarks: 100, action: 'update' } },
      res,
    );

    expect(EducationTask.findByIdAndUpdate).toHaveBeenCalledWith(
      'x',
      expect.objectContaining({ grade: 'Excellent' }),
      expect.any(Object),
    );
  });

  test('applies a grade scale exposed via a Mongoose-style toObject method', async () => {
    EducationTask.findById.mockResolvedValue({
      _id: 'x',
      gradeScale: { toObject: () => ({ Excellent: 90, Pass: 70, Fail: 0 }) },
    });
    EducationTask.findByIdAndUpdate.mockReturnValue(makeChain({ _id: 'x' }));
    const res = mockRes();

    await controller.updateSubmissionGrade(
      { params: { submissionId: 'x' }, body: { marks: 95, maxMarks: 100, action: 'update' } },
      res,
    );

    expect(EducationTask.findByIdAndUpdate).toHaveBeenCalledWith(
      'x',
      expect.objectContaining({ grade: 'Excellent' }),
      expect.any(Object),
    );
  });

  test('resolves educatorId from req.user when no explicit educatorId is sent', async () => {
    EducationTask.findById.mockResolvedValue({ _id: 'x' });
    EducationTask.findByIdAndUpdate.mockReturnValue(makeChain({ _id: 'x' }));
    const res = mockRes();

    await controller.updateSubmissionGrade(
      {
        params: { submissionId: 'x' },
        body: { feedback: 'ok', action: 'update' },
        user: { _id: 'educatorFromReqUser' },
      },
      res,
    );

    expect(EducationTask.findByIdAndUpdate).toHaveBeenCalledWith(
      'x',
      expect.objectContaining({ educatorId: 'educatorFromReqUser' }),
      expect.any(Object),
    );
  });

  test('does not set educatorId when it cannot be resolved from anywhere', async () => {
    EducationTask.findById.mockResolvedValue({ _id: 'x' });
    EducationTask.findByIdAndUpdate.mockReturnValue(makeChain({ _id: 'x' }));
    const res = mockRes();

    await controller.updateSubmissionGrade(
      { params: { submissionId: 'x' }, body: { feedback: 'ok', action: 'update' } },
      res,
    );

    expect(EducationTask.findByIdAndUpdate).toHaveBeenCalledWith(
      'x',
      expect.not.objectContaining({ educatorId: expect.anything() }),
      expect.any(Object),
    );
  });

  test('falls back to the existing marks/maxMarks on the task when not provided', async () => {
    EducationTask.findById.mockResolvedValue({ _id: 'x', marks: 90, maxMarks: 100 });
    EducationTask.findByIdAndUpdate.mockReturnValue(makeChain({ _id: 'x' }));
    const res = mockRes();

    await controller.updateSubmissionGrade(
      { params: { submissionId: 'x' }, body: { feedback: 'ok', action: 'update' } },
      res,
    );

    expect(EducationTask.findByIdAndUpdate).toHaveBeenCalledWith(
      'x',
      expect.objectContaining({ grade: 'A' }),
      expect.any(Object),
    );
  });

  test('does not force status to graded when publishing a pending grade', async () => {
    EducationTask.findById.mockResolvedValue({ _id: 'x' });
    EducationTask.findByIdAndUpdate.mockReturnValue(makeChain({ _id: 'x' }));
    const res = mockRes();

    await controller.updateSubmissionGrade(
      { params: { submissionId: 'x' }, body: { feedback: 'ok', action: 'publish' } },
      res,
    );

    expect(EducationTask.findByIdAndUpdate).toHaveBeenCalledWith(
      'x',
      expect.not.objectContaining({ status: 'graded' }),
      expect.any(Object),
    );
  });

  test('leaves submissionStatus untouched for an unrecognized action', async () => {
    EducationTask.findById.mockResolvedValue({ _id: 'x' });
    EducationTask.findByIdAndUpdate.mockReturnValue(makeChain({ _id: 'x' }));
    const res = mockRes();

    await controller.updateSubmissionGrade(
      { params: { submissionId: 'x' }, body: { feedback: 'ok' } },
      res,
    );

    expect(EducationTask.findByIdAndUpdate).toHaveBeenCalledWith(
      'x',
      expect.not.objectContaining({ submissionStatus: expect.anything() }),
      expect.any(Object),
    );
  });

  test('does not overwrite gradeUpdatedAt when publishing a grade that already has one', async () => {
    EducationTask.findById.mockResolvedValue({ _id: 'x', gradeUpdatedAt: new Date('2020-01-01') });
    EducationTask.findByIdAndUpdate.mockReturnValue(makeChain({ _id: 'x' }));
    const res = mockRes();

    await controller.updateSubmissionGrade(
      {
        params: { submissionId: 'x' },
        body: { marks: 90, maxMarks: 100, action: 'publish' },
      },
      res,
    );

    expect(EducationTask.findByIdAndUpdate).toHaveBeenCalledWith(
      'x',
      expect.not.objectContaining({ gradeUpdatedAt: expect.anything() }),
      expect.any(Object),
    );
  });
});

describe('getReviewSubmissions', () => {
  test('builds an $or filter for completed or submitted tasks', async () => {
    EducationTask.find.mockReturnValue(makeChain([]));
    const res = mockRes();

    await controller.getReviewSubmissions({ query: { lessonPlanId: 'lp1' } }, res);

    expect(EducationTask.find).toHaveBeenCalledWith(
      expect.objectContaining({
        lessonPlanId: 'lp1',
        $or: [
          { status: 'completed' },
          { submissionStatus: { $in: ['Submitted', 'Grade Updated', 'Grade Posted'] } },
        ],
      }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('applies status and submissionStatus filters when provided', async () => {
    EducationTask.find.mockReturnValue(makeChain([]));
    const res = mockRes();

    await controller.getReviewSubmissions(
      { query: { status: 'graded', submissionStatus: 'Grade Posted' } },
      res,
    );

    expect(EducationTask.find).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'graded', submissionStatus: 'Grade Posted' }),
    );
  });

  test('returns 500 on unexpected error', async () => {
    EducationTask.find.mockImplementation(() => {
      throw new Error('boom');
    });
    const res = mockRes();

    await controller.getReviewSubmissions({ query: {} }, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('getTaskSubmissions', () => {
  test('rejects an unrecognized status filter', async () => {
    const res = mockRes();

    await controller.getTaskSubmissions({ query: { status: 'not-a-real-status' } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('maps "pending submissions" to the assigned status bucket', async () => {
    EducationTask.find.mockReturnValue(makeChain([]));
    const res = mockRes();

    await controller.getTaskSubmissions({ query: { status: 'pending submissions' } }, res);

    expect(EducationTask.find).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'assigned' }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('formats submissions with computed status and late flags', async () => {
    const dueAt = new Date('2026-01-01T00:00:00Z');
    const completedAt = new Date('2026-01-05T00:00:00Z');
    EducationTask.find.mockReturnValue(
      makeChain([
        {
          _id: 't1',
          studentId: { _id: 's1', firstName: 'Jane', lastName: 'Doe', email: 'j@x.com' },
          lessonPlanId: { title: 'Lesson 1' },
          name: 'Task 1',
          type: 'write',
          uploadUrls: [],
          status: 'completed',
          completedAt,
          assignedAt: dueAt,
          dueAt,
        },
      ]),
    );
    const res = mockRes();

    await controller.getTaskSubmissions({ query: {} }, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload[0].status).toBe('Pending Review');
    expect(payload[0].submittedAt).toEqual(completedAt);
  });

  test('rejects an invalid studentId filter', async () => {
    const res = mockRes();

    await controller.getTaskSubmissions({ query: { studentId: 'not-an-id' } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('accepts student_id as an alias for studentId', async () => {
    const studentId = new mongoose.Types.ObjectId().toString();
    EducationTask.find.mockReturnValue(makeChain([]));
    const res = mockRes();

    await controller.getTaskSubmissions({ query: { student_id: studentId } }, res);

    expect(EducationTask.find).toHaveBeenCalledWith(
      expect.objectContaining({ studentId: expect.any(mongoose.Types.ObjectId) }),
    );
  });

  test('accepts courseId as an alias for lessonPlanId', async () => {
    const courseId = new mongoose.Types.ObjectId().toString();
    EducationTask.find.mockReturnValue(makeChain([]));
    const res = mockRes();

    await controller.getTaskSubmissions({ query: { courseId } }, res);

    expect(EducationTask.find).toHaveBeenCalledWith(
      expect.objectContaining({ lessonPlanId: expect.any(mongoose.Types.ObjectId) }),
    );
  });

  test('accepts course_id as an alias for lessonPlanId', async () => {
    const course_id = new mongoose.Types.ObjectId().toString();
    EducationTask.find.mockReturnValue(makeChain([]));
    const res = mockRes();

    await controller.getTaskSubmissions({ query: { course_id } }, res);

    expect(EducationTask.find).toHaveBeenCalledWith(
      expect.objectContaining({ lessonPlanId: expect.any(mongoose.Types.ObjectId) }),
    );
  });

  test('rejects an invalid courseId filter', async () => {
    const res = mockRes();

    await controller.getTaskSubmissions({ query: { courseId: 'not-an-id' } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('drops submissions missing a populated student or lesson plan', async () => {
    EducationTask.find.mockReturnValue(
      makeChain([
        { _id: 't1', studentId: null, lessonPlanId: { title: 'Lesson' } },
        { _id: 't2', studentId: { _id: 's1' }, lessonPlanId: null },
      ]),
    );
    const res = mockRes();

    await controller.getTaskSubmissions({ query: {} }, res);

    expect(res.json).toHaveBeenCalledWith([]);
  });

  test('fills in defaults for a minimal submission and flags it graded', async () => {
    EducationTask.find.mockReturnValue(
      makeChain([
        {
          _id: 't1',
          studentId: { _id: 's1', firstName: 'A', lastName: 'B' },
          lessonPlanId: { _id: 'lp1' },
          status: 'graded',
        },
      ]),
    );
    const res = mockRes();

    await controller.getTaskSubmissions({ query: {} }, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload[0].taskName).toBe('Unnamed Task');
    expect(payload[0].status).toBe('Graded');
    expect(payload[0].submissionLinks).toEqual([]);
    expect(payload[0].lessonPlanTitle).toBe('Unknown Lesson Plan');
    expect(payload[0].late).toBe(false);
    expect(payload[0].overdue).toBeFalsy();
  });

  test('flags a submission as late when completed after the due date', async () => {
    const dueAt = new Date('2026-01-01T00:00:00Z');
    const completedAt = new Date('2026-01-05T00:00:00Z');
    EducationTask.find.mockReturnValue(
      makeChain([
        {
          _id: 't1',
          studentId: { _id: 's1', firstName: 'A', lastName: 'B' },
          lessonPlanId: { title: 'Lesson' },
          status: 'completed',
          dueAt,
          completedAt,
        },
      ]),
    );
    const res = mockRes();

    await controller.getTaskSubmissions({ query: {} }, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload[0].late).toBe(true);
    expect(payload[0].lateByMs).toBeGreaterThan(0);
  });

  test('flags an assigned task as overdue when past its due date without a submission', async () => {
    const dueAt = new Date('2000-01-01T00:00:00Z');
    EducationTask.find.mockReturnValue(
      makeChain([
        {
          _id: 't1',
          studentId: { _id: 's1', firstName: 'A', lastName: 'B' },
          lessonPlanId: { title: 'Lesson' },
          status: 'assigned',
          dueAt,
        },
      ]),
    );
    const res = mockRes();

    await controller.getTaskSubmissions({ query: { status: 'pending' } }, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload[0].overdue).toBe(true);
    expect(payload[0].late).toBe(false);
  });
});
