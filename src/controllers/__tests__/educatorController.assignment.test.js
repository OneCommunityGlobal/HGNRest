jest.mock('../../models/lessonPlan', () => ({ findById: jest.fn() }));
jest.mock('../../models/activity', () => ({ find: jest.fn() }));
jest.mock('../../models/educationTask', () => {
  const Model = jest.fn();
  Model.find = jest.fn();
  Model.findOne = jest.fn();
  return Model;
});
jest.mock('../../models/progress', () => ({
  find: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));
jest.mock('../../models/atom', () => ({ findById: jest.fn() }));
jest.mock('../../models/userProfile', () => ({
  find: jest.fn(),
  findById: jest.fn(),
}));
jest.mock('../../models/studentAtom', () => ({}));
jest.mock('../../services/studentEvaluationResultsService', () => ({}));

const mongoose = require('mongoose');
const LessonPlan = require('../../models/lessonPlan');
const Activity = require('../../models/activity');
const EducationTask = require('../../models/educationTask');
const Progress = require('../../models/progress');
const Atom = require('../../models/atom');
const UserProfile = require('../../models/userProfile');
const educatorController = require('../educatorController')();

const lessonPlanId = 'lesson-plan-1';
const studentId = 'student-1';
const atomId = 'atom-1';
const prerequisiteId = 'prerequisite-1';
const assignmentDate = '2030-01-01';
const request = {
  body: {
    lesson_plan_id: lessonPlanId,
    assignment_date: assignmentDate,
    is_auto_assigned: true,
    deadline_offset_days: 3,
  },
};

const response = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
});

const makeQuery = (result) => ({
  populate: jest.fn().mockReturnThis(),
  session: jest.fn().mockResolvedValue(result),
});

let session;
let createdTaskSave;
let atomTaskQuery;
let activityQuery;
let studentsQuery;

beforeEach(() => {
  jest.clearAllMocks();
  session = {
    startTransaction: jest.fn(),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    abortTransaction: jest.fn().mockResolvedValue(undefined),
    endSession: jest.fn(),
  };
  jest.spyOn(mongoose, 'startSession').mockResolvedValue(session);

  const plan = { _id: lessonPlanId, title: 'Plan', theme: 'Science' };
  LessonPlan.findById.mockReturnValue(makeQuery(plan));
  activityQuery = {
    session: jest.fn().mockResolvedValue([
      {
        atomTaskTemplates: [
          { atomId, subjectId: 'subject-1', taskType: 'Write-only', instructions: 'Complete it' },
        ],
      },
    ]),
  };
  Activity.find.mockReturnValue(activityQuery);
  studentsQuery = { select: jest.fn().mockResolvedValue([{ _id: studentId }]) };
  UserProfile.find.mockReturnValue(studentsQuery);
  atomTaskQuery = { populate: jest.fn().mockResolvedValue({ prerequisites: [] }) };
  Atom.findById.mockReturnValue(atomTaskQuery);
  EducationTask.findOne.mockReturnValue(makeQuery(null));
  createdTaskSave = jest.fn().mockResolvedValue({ _id: 'task-1' });
  EducationTask.mockImplementation(() => ({ save: createdTaskSave }));
  Progress.find.mockResolvedValue([]);
  Progress.findOneAndUpdate.mockResolvedValue({});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('assignTasks validation and transaction lifecycle', () => {
  test.each([
    [{ body: {} }, 400, 'lesson_plan_id and assignment_date are required'],
    [
      { body: { lesson_plan_id: lessonPlanId } },
      400,
      'lesson_plan_id and assignment_date are required',
    ],
  ])('rejects invalid request body and releases the session', async (req, status, message) => {
    const res = response();

    await educatorController.assignTasks(req, res);

    expect(res.status).toHaveBeenCalledWith(status);
    expect(res.json).toHaveBeenCalledWith({ error: message });
    expect(session.startTransaction).toHaveBeenCalledTimes(1);
    expect(session.endSession).toHaveBeenCalledTimes(1);
    expect(session.commitTransaction).not.toHaveBeenCalled();
    expect(session.abortTransaction).not.toHaveBeenCalled();
  });

  test('returns not found when the lesson plan does not exist', async () => {
    LessonPlan.findById.mockReturnValue(makeQuery(null));
    const res = response();

    await educatorController.assignTasks(request, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Lesson plan not found' });
    expect(session.endSession).toHaveBeenCalledTimes(1);
    expect(session.commitTransaction).not.toHaveBeenCalled();
  });

  test('rejects lesson plans with no activities', async () => {
    const res = response();
    activityQuery.session.mockResolvedValueOnce([]);
    await educatorController.assignTasks(request, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'No activities found for this lesson plan' });
    expect(session.commitTransaction).not.toHaveBeenCalled();
  });

  test('rejects activities with no task templates', async () => {
    const res = response();
    activityQuery.session.mockResolvedValueOnce([{ atomTaskTemplates: [] }]);
    await educatorController.assignTasks(request, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'No task templates found in lesson plan activities',
    });
    expect(UserProfile.find).not.toHaveBeenCalled();
    expect(session.commitTransaction).not.toHaveBeenCalled();
  });

  test('rejects when there are no enrolled students', async () => {
    const res = response();
    studentsQuery.select.mockResolvedValueOnce([]);
    await educatorController.assignTasks(request, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'No enrolled students found' });
    expect(session.commitTransaction).not.toHaveBeenCalled();
  });

  test('aborts when loading enrolled students fails', async () => {
    const res = response();
    studentsQuery.select.mockRejectedValueOnce(new Error('student lookup failed'));

    await educatorController.assignTasks(request, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Assignment failed: Error fetching enrolled students: student lookup failed',
      success: false,
    });
    expect(session.abortTransaction).toHaveBeenCalledTimes(1);
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });
});

describe('assignTasks assignment and prerequisites', () => {
  test('creates an assignment and progress record when the atom has no prerequisites', async () => {
    const res = response();

    await educatorController.assignTasks(request, res);

    expect(Atom.findById).toHaveBeenCalledWith(atomId);
    expect(atomTaskQuery.populate).toHaveBeenCalledWith('prerequisites');
    expect(EducationTask).toHaveBeenCalledWith(
      expect.objectContaining({
        lessonPlanId,
        studentId,
        atomIds: [atomId],
        status: 'assigned',
        assignedAt: new Date(assignmentDate),
        dueAt: new Date('2030-01-04T00:00:00.000Z'),
        grade: 'pending',
      }),
    );
    expect(createdTaskSave).toHaveBeenCalledWith({ session });
    expect(Progress.findOneAndUpdate).toHaveBeenCalledWith(
      { studentId, atomId },
      expect.objectContaining({ status: 'in_progress' }),
      { upsert: true, new: true, session },
    );
    expect(session.commitTransaction).toHaveBeenCalledTimes(1);
    expect(session.abortTransaction).not.toHaveBeenCalled();
    expect(session.endSession).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('assigns when all prerequisites are complete', async () => {
    atomTaskQuery.populate.mockResolvedValueOnce({ prerequisites: [{ _id: prerequisiteId }] });
    Progress.find.mockResolvedValueOnce([{ atomId: prerequisiteId }]);
    const res = response();

    await educatorController.assignTasks(request, res);

    expect(Progress.find).toHaveBeenCalledWith({
      studentId,
      atomId: { $in: [prerequisiteId] },
      status: 'completed',
    });
    expect(createdTaskSave).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('records an unmet prerequisite as a skipped student without creating a task', async () => {
    atomTaskQuery.populate.mockResolvedValueOnce({ prerequisites: [{ _id: prerequisiteId }] });
    Progress.find.mockResolvedValueOnce([]);
    const res = response();

    await educatorController.assignTasks(request, res);

    expect(createdTaskSave).not.toHaveBeenCalled();
    expect(Progress.findOneAndUpdate).not.toHaveBeenCalled();
    expect(session.commitTransaction).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: expect.objectContaining({
          success_count: 0,
          failure_count: 1,
          skipped: [studentId],
          errors: [{ studentId, atomId, reason: 'Prerequisites not completed' }],
        }),
      }),
    );
  });

  test('does not duplicate an existing student task', async () => {
    EducationTask.findOne.mockReturnValue(makeQuery({ _id: 'existing-task' }));
    const res = response();

    await educatorController.assignTasks(request, res);

    expect(createdTaskSave).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: expect.objectContaining({
          failure_count: 1,
          errors: [{ studentId, atomId, reason: 'Task already assigned' }],
        }),
      }),
    );
  });

  test('aborts and releases the session when an assignment query fails', async () => {
    activityQuery.session.mockRejectedValueOnce(new Error('activity lookup failed'));
    const res = response();

    await educatorController.assignTasks(request, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Assignment failed: activity lookup failed',
      success: false,
    });
    expect(session.abortTransaction).toHaveBeenCalledTimes(1);
    expect(session.commitTransaction).not.toHaveBeenCalled();
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });

  test('aborts when transaction commit fails', async () => {
    session.commitTransaction.mockRejectedValueOnce(new Error('commit failed'));
    const res = response();

    await educatorController.assignTasks(request, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Assignment failed: commit failed',
      success: false,
    });
    expect(session.abortTransaction).toHaveBeenCalledTimes(1);
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });
});

describe('getAssignmentSummary', () => {
  test('counts assignments by status, unique students, and limits recent results', async () => {
    const tasks = Array.from({ length: 12 }, (_, index) => ({
      status: ['assigned', 'in_progress', 'completed', 'graded'][index % 4],
      studentId: { _id: `student-${index % 3}` },
      index,
    }));
    const query = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockResolvedValue(tasks),
    };
    EducationTask.find.mockReturnValue(query);
    const res = response();

    await educatorController.getAssignmentSummary({ params: { lessonPlanId } }, res);

    expect(EducationTask.find).toHaveBeenCalledWith({ lessonPlanId });
    expect(res.json).toHaveBeenCalledWith({
      total_assignments: 12,
      by_status: { assigned: 3, in_progress: 3, completed: 3, graded: 3 },
      students: 3,
      recent_assignments: tasks.slice(0, 10),
    });
  });

  test('returns an error when the summary query fails', async () => {
    EducationTask.find.mockImplementation(() => {
      throw new Error('summary lookup failed');
    });
    const res = response();

    await educatorController.getAssignmentSummary({ params: { lessonPlanId } }, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'summary lookup failed' });
  });
});
