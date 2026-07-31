const mongoose = require('mongoose');

/* =======================
   MOCKS (MUST COME FIRST)
   ======================= */

jest.mock('../../models/educationTask', () => ({
  find: jest.fn(),
  findById: jest.fn(),
  findOne: jest.fn(),
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
    EducationTask.find.mockReturnValue(makeChain([{ _id: '1' }]));
    const res = mockRes();

    await controller.getEducationTasks({}, res);

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

    await controller.createTask({ body: { ...baseBody, studentId: 's1' } }, res);

    expect(EducationTask.insertMany).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

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

    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('returns 500 on unexpected error', async () => {
    LessonPlan.findById.mockRejectedValue(new Error('boom'));
    const res = mockRes();

    await controller.createTask({ body: { ...baseBody, studentId: 's1' } }, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('updateTask', () => {
  test('returns 404 when task not found', async () => {
    EducationTask.findById.mockResolvedValue(null);
    const res = mockRes();

    await controller.updateTask({ params: { id: 'x' }, body: {} }, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns 400 for an invalid status', async () => {
    EducationTask.findById.mockResolvedValue({ _id: 'x', status: 'assigned' });
    const res = mockRes();

    await controller.updateTask({ params: { id: 'x' }, body: { status: 'bogus' } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('updates and returns the task', async () => {
    EducationTask.findById.mockResolvedValue({ _id: 'x', status: 'assigned' });
    EducationTask.findByIdAndUpdate.mockReturnValue(makeChain({ _id: 'x', status: 'completed' }));
    const res = mockRes();

    await controller.updateTask({ params: { id: 'x' }, body: { status: 'completed' } }, res);

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
  test('returns 400 when taskId or studentId is missing', async () => {
    const res = mockRes();
    await controller.markTaskAsComplete({ body: {} }, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns 400 for malformed ids', async () => {
    const res = mockRes();
    await controller.markTaskAsComplete(
      { body: { taskId: 'not-an-id', studentId: 'also-not-an-id' } },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns 404 when no matching task is found', async () => {
    const taskId = new mongoose.Types.ObjectId().toString();
    const studentId = new mongoose.Types.ObjectId().toString();
    EducationTask.findOne.mockResolvedValue(null);
    const res = mockRes();

    await controller.markTaskAsComplete({ body: { taskId, studentId } }, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns the task unchanged if already completed', async () => {
    const taskId = new mongoose.Types.ObjectId().toString();
    const studentId = new mongoose.Types.ObjectId().toString();
    EducationTask.findOne.mockResolvedValue({ status: 'completed' });
    const res = mockRes();

    await controller.markTaskAsComplete({ body: { taskId, studentId } }, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(EducationTask.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test('marks an assigned task complete', async () => {
    const taskId = new mongoose.Types.ObjectId().toString();
    const studentId = new mongoose.Types.ObjectId().toString();
    EducationTask.findOne.mockResolvedValue({ status: 'assigned' });
    EducationTask.findByIdAndUpdate.mockReturnValue(makeChain({ status: 'completed' }));
    const res = mockRes();

    await controller.markTaskAsComplete({ body: { taskId, studentId } }, res);

    expect(res.status).toHaveBeenCalledWith(200);
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
});
