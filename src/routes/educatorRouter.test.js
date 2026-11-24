/* eslint-disable import/order, import/newline-after-import */
const express = require('express');
const request = require('supertest');
jest.mock('../controllers/educatorController', () => () => ({
  assignTasks: jest.fn(),
  assignAtoms: jest.fn(),
  publishEvaluationResults: jest.fn(),
}));
jest.mock('../models/lessonPlan', () => ({ findById: jest.fn() }));
jest.mock('../models/educationTask', () => ({ bulkWrite: jest.fn(), exists: jest.fn() }));
jest.mock('../models/userProfile', () => ({ find: jest.fn() }));
jest.mock('../models/lessonPlanLog', () => ({ create: jest.fn(), find: jest.fn() }));
const LessonPlan = require('../models/lessonPlan');
const EducationTask = require('../models/educationTask');
const UserProfile = require('../models/userProfile');
const LessonPlanLog = require('../models/lessonPlanLog');
const educatorRouter = require('./educatorRouter');
const educatorId = '507f1f77bcf86cd799439014';
let authenticatedRequestor;
const app = express();
app.use(express.json());
// Mimic global JWT middleware: payload identity cannot override authenticated identity.
app.use((req, res, next) => {
  req.body.requestor = authenticatedRequestor;
  next();
});
app.use('/api/educator', educatorRouter);
const taskId = '507f1f77bcf86cd799439011';
const secondId = '507f1f77bcf86cd799439012';
const thirdId = '507f1f77bcf86cd799439013';
const payload = {
  lessonPlanId: 'lesson-plan-1',
  assignmentDate: '2026-11-17',
  isAutoAssigned: false,
  requestor: { requestorId: educatorId, role: 'Educator' },
};
const assign = () => request(app).post('/api/educator/assign-tasks').send(payload);
const bulkResult = (indexes = []) => ({
  getUpsertedIds: () => indexes.map((index) => ({ index, _id: `task-${index}` })),
});
const key = ({ lessonPlanId, studentId, subTaskId }) => `${lessonPlanId}/${studentId}/${subTaskId}`;
let stored;

beforeEach(() => {
  jest.resetAllMocks();
  authenticatedRequestor = { requestorId: educatorId, role: 'Educator' };
  stored = new Map();
  LessonPlan.findById.mockResolvedValue({
    createdBy: educatorId,
    subTasks: [
      { _id: taskId, name: 'Task 1' },
      { _id: secondId, name: 'Task 2' },
    ],
  });
  UserProfile.find.mockResolvedValue([{ _id: 'student-1' }, { _id: 'student-2' }]);
  LessonPlanLog.create.mockResolvedValue({});
  // In-memory atomic insert simulation; no connection or database write is made.
  EducationTask.bulkWrite.mockImplementation(async (operations) => {
    const inserted = [];
    operations.forEach(({ updateOne }, index) => {
      const identity = key(updateOne.filter);
      if (!stored.has(identity)) {
        stored.set(identity, { ...updateOne.update.$setOnInsert });
        inserted.push(index);
      }
    });
    return bulkResult(inserted);
  });
});

describe('POST /api/educator/assign-tasks', () => {
  it('counts inserted tasks and logs distinct students on initial assignment', async () => {
    const response = await assign();
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ assignedCount: 4, skippedCount: 0 });
    expect(stored.size).toBe(4);
    expect(EducationTask.bulkWrite).toHaveBeenCalledWith(expect.any(Array), { ordered: false });
    expect(LessonPlanLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ details: 'Assigned to 2 students. Skipped 0.' }),
    );
  });

  it('does not reassign existing tasks on a repeated request', async () => {
    await assign();
    const response = await assign();
    expect(response.body).toEqual({ assignedCount: 0, skippedCount: 0 });
    expect(stored.size).toBe(4);
    expect(LessonPlanLog.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ details: 'Assigned to 0 students. Skipped 0.' }),
    );
  });

  it('assigns only newly added subtasks', async () => {
    await assign();
    LessonPlan.findById.mockResolvedValue({
      createdBy: educatorId,
      subTasks: [
        { _id: taskId, name: 'Task 1' },
        { _id: secondId, name: 'Task 2' },
        { _id: thirdId, name: 'Task 3' },
      ],
    });
    expect((await assign()).body).toEqual({ assignedCount: 2, skippedCount: 0 });
    expect(stored.size).toBe(6);
  });

  it('uses only setOnInsert and preserves completed task progress and timestamps', async () => {
    await assign();
    const existing = stored.values().next().value;
    Object.assign(existing, {
      status: 'Completed',
      submission: 'file.pdf',
      grade: 'A',
      loggedHours: 12,
    });
    const before = { ...existing };
    await assign();
    expect(existing).toEqual(before);
    EducationTask.bulkWrite.mock.calls[1][0].forEach(({ updateOne }) => {
      expect(Object.keys(updateOne.update)).toEqual(['$setOnInsert']);
      expect(updateOne).toMatchObject({
        upsert: true,
        timestamps: false,
        setDefaultsOnInsert: true,
      });
    });
  });

  it('leaves legacy records without subTaskId untouched', async () => {
    const legacy = {
      lessonPlanId: payload.lessonPlanId,
      studentId: 'student-1',
      title: 'Task 1',
      status: 'Completed',
    };
    stored.set('legacy', legacy);
    expect((await assign()).body.assignedCount).toBe(4);
    expect(stored.get('legacy')).toEqual(legacy);
    expect(stored.get('legacy')).not.toHaveProperty('subTaskId');
    expect(stored.size).toBe(5);
  });

  it('handles concurrent duplicate-key races after checking the exact assignment exists', async () => {
    const insert = EducationTask.bulkWrite.getMockImplementation();
    EducationTask.bulkWrite
      .mockImplementationOnce(insert)
      .mockImplementationOnce(async (operations) => {
        throw Object.assign(new Error('duplicate key'), {
          writeErrors: operations.map((operation, index) => ({ code: 11000, index })),
          result: bulkResult(),
        });
      });
    EducationTask.exists.mockImplementation(async (filter) => stored.has(key(filter)));
    const responses = await Promise.all([assign(), assign()]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(responses.reduce((sum, response) => sum + response.body.assignedCount, 0)).toBe(4);
    expect(stored.size).toBe(4);
    expect(EducationTask.exists).toHaveBeenCalledWith({
      lessonPlanId: payload.lessonPlanId,
      studentId: 'student-1',
      subTaskId: taskId,
    });
  });

  it('counts partial inserts when another operation loses a duplicate-key race', async () => {
    EducationTask.bulkWrite.mockRejectedValue({
      writeErrors: [{ code: 11000, index: 0 }],
      result: bulkResult([1, 2, 3]),
    });
    EducationTask.exists.mockResolvedValue(true);
    expect((await assign()).body).toEqual({ assignedCount: 3, skippedCount: 0 });
  });

  it('does not swallow duplicate-key errors when the intended assignment is absent', async () => {
    EducationTask.bulkWrite.mockRejectedValue({
      writeErrors: [{ code: 11000, index: 0 }],
      result: bulkResult(),
    });
    EducationTask.exists.mockResolvedValue(false);
    expect((await assign()).status).toBe(500);
    expect(LessonPlanLog.create).not.toHaveBeenCalled();
  });

  it.each([
    new Error('database write failed'),
    { writeErrors: [{ code: 121, index: 0 }], result: bulkResult() },
    {
      writeErrors: [{ code: 11000, index: 0 }],
      result: { ...bulkResult(), getWriteConcernError: () => ({ code: 64 }) },
    },
  ])('returns 500 without a success log for database failures %#', async (error) => {
    EducationTask.bulkWrite.mockRejectedValue(error);
    expect((await assign()).status).toBe(500);
    expect(LessonPlanLog.create).not.toHaveBeenCalled();
  });

  it('does not log request data or error details when assignment fails', async () => {
    const sensitiveDetails = 'untrusted assignment details';
    const logError = jest.spyOn(console, 'error').mockImplementation(() => {});
    EducationTask.bulkWrite.mockRejectedValue(new Error(sensitiveDetails));

    const response = await assign();

    expect(response.status).toBe(500);
    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledWith('Task assignment failed');
    expect(JSON.stringify(logError.mock.calls)).not.toContain(sensitiveDetails);
    logError.mockRestore();
  });

  it('returns 500 for an unexpected bulk result', async () => {
    EducationTask.bulkWrite.mockResolvedValue({});
    expect((await assign()).status).toBe(500);
    expect(LessonPlanLog.create).not.toHaveBeenCalled();
  });

  it('rejects missing subtask identity without creating legacy-style records', async () => {
    LessonPlan.findById.mockResolvedValue({
      createdBy: educatorId,
      subTasks: [{ name: 'Missing ID' }],
    });
    expect((await assign()).status).toBe(500);
    expect(EducationTask.bulkWrite).not.toHaveBeenCalled();
  });

  it('returns 404 when the plan has no subtasks', async () => {
    LessonPlan.findById.mockResolvedValue({ createdBy: educatorId, subTasks: [] });
    const response = await assign();
    expect(response.status).toBe(404);
    expect(response.body.message).toBe('Lesson plan not found or it has no sub-tasks to assign.');
    expect(EducationTask.bulkWrite).not.toHaveBeenCalled();
    expect(LessonPlanLog.create).not.toHaveBeenCalled();
  });

  it('returns 404 when no eligible students exist', async () => {
    UserProfile.find.mockResolvedValue([]);
    const response = await assign();
    expect(response.status).toBe(404);
    expect(response.body.message).toBe('No eligible students found to assign tasks to.');
    expect(EducationTask.bulkWrite).not.toHaveBeenCalled();
    expect(LessonPlanLog.create).not.toHaveBeenCalled();
  });
});

it('does not log request parameters or error details when lesson-plan logs fail', async () => {
  const sensitiveDetails = 'untrusted log query details';
  const logError = jest.spyOn(console, 'error').mockImplementation(() => {});
  LessonPlanLog.find.mockImplementation(() => {
    throw new Error(sensitiveDetails);
  });

  const response = await request(app).get('/api/educator/logs/secret-input').send({});

  expect(response.status).toBe(500);
  expect(logError).toHaveBeenCalledWith('Lesson plan log retrieval failed');
  expect(JSON.stringify(logError.mock.calls)).not.toContain(sensitiveDetails);
  expect(JSON.stringify(logError.mock.calls)).not.toContain('secret-input');
  logError.mockRestore();
});

it('returns populated lesson-plan assignment logs', async () => {
  const logs = [{ lessonPlanId: 'plan-1', action: 'Manual Assignment' }];
  const query = {
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockResolvedValue(logs),
  };
  LessonPlanLog.find.mockReturnValue(query);

  const response = await request(app).get('/api/educator/logs/plan-1').send({});

  expect(LessonPlanLog.find).toHaveBeenCalledWith({ lessonPlanId: 'plan-1' });
  expect(query.populate).toHaveBeenCalledWith('editorId', 'firstName lastName email');
  expect(query.sort).toHaveBeenCalledWith({ logDateTime: -1 });
  expect(response.status).toBe(200);
  expect(response.body).toEqual(logs);
});

test('the unique index covers only ObjectId subtask assignments, preserving atom and legacy records', () => {
  const Model = jest.requireActual('../models/educationTask');
  expect(Model.schema.path('subTaskId').instance).toBe('ObjectID');
  expect(Model.schema.indexes()).toContainEqual([
    { lessonPlanId: 1, studentId: 1, subTaskId: 1 },
    expect.objectContaining({
      unique: true,
      partialFilterExpression: { subTaskId: { $type: 'objectId' } },
    }),
  ]);
  const legacy = new Model({
    name: 'Legacy Task',
    lessonPlanId: taskId,
    studentId: secondId,
    atomIds: [thirdId],
  });
  expect(legacy.validateSync()).toBeUndefined();
  expect(legacy.subTaskId).toBeUndefined();
});

describe('assignment authorization', () => {
  const expectNoWrites = () => {
    expect(EducationTask.bulkWrite).not.toHaveBeenCalled();
    expect(LessonPlanLog.create).not.toHaveBeenCalled();
    expect(UserProfile.find).not.toHaveBeenCalled();
  };

  it('allows an educator to assign their own plan', async () => {
    expect((await assign()).status).toBe(200);
    expect(EducationTask.bulkWrite).toHaveBeenCalledTimes(1);
  });

  it('rejects an educator assigning another creator’s plan', async () => {
    authenticatedRequestor = { requestorId: thirdId, role: 'Educator' };
    expect((await assign()).status).toBe(403);
    expectNoWrites();
  });

  it.each(['Administrator', 'Owner'])(
    'allows %s to assign another creator’s plan',
    async (role) => {
      authenticatedRequestor = { requestorId: thirdId, role };
      expect((await assign()).status).toBe(200);
      expect(LessonPlanLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ editorId: thirdId }),
      );
    },
  );

  it.each(['Student', 'Volunteer', 'Manager', 'Mentor', 'Core Team'])(
    'rejects authenticated role %s before lookup',
    async (role) => {
      authenticatedRequestor = { requestorId: educatorId, role };
      expect((await assign()).status).toBe(403);
      expect(LessonPlan.findById).not.toHaveBeenCalled();
      expectNoWrites();
    },
  );

  it.each([undefined, {}, { requestorId: 'invalid', role: 'Educator' }])(
    'rejects missing authenticated identity %#',
    async (identity) => {
      authenticatedRequestor = identity;
      // The body still supplies an educator identity; the middleware must overwrite it.
      expect((await assign()).status).toBe(401);
      expect(LessonPlan.findById).not.toHaveBeenCalled();
      expectNoWrites();
    },
  );

  it('preserves 400 for an omitted lessonPlanId', async () => {
    const response = await request(app).post('/api/educator/assign-tasks').send({});
    expect(response.status).toBe(400);
    expect(LessonPlan.findById).not.toHaveBeenCalled();
    expectNoWrites();
  });

  it('returns 404 for a nonexistent lesson plan', async () => {
    LessonPlan.findById.mockResolvedValue(null);
    expect((await assign()).status).toBe(404);
    expectNoWrites();
  });
});
