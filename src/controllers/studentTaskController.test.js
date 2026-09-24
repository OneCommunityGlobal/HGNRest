jest.mock('../models/bmdashboard/studentTask', () => {
  const StudentTask = jest.fn().mockImplementation(function ctor(data) {
    Object.assign(this, data);
    this.save = jest.fn().mockResolvedValue(this);
  });
  StudentTask.find = jest.fn();
  StudentTask.findOne = jest.fn();
  StudentTask.findByIdAndUpdate = jest.fn();
  return StudentTask;
});

jest.mock('../models/studentAtom', () => ({
  findOneAndUpdate: jest.fn(),
}));

jest.mock('../models/educationTask', () => ({
  aggregate: jest.fn(),
  findOneAndUpdate: jest.fn(),
  findOne: jest.fn(),
}));

jest.mock('../models/userProfile', () => ({
  findById: jest.fn(),
}));

jest.mock('../models/task', () => ({
  findById: jest.fn(),
}));

jest.mock('../models/lessonPlan', () => ({
  findById: jest.fn(),
}));

jest.mock('../utilities/AzureBlobImages', () => ({
  uploadFileToAzureBlobStorage: jest.fn(),
}));

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
}));

const jwt = require('jsonwebtoken');
const StudentTask = require('../models/bmdashboard/studentTask');
const StudentAtom = require('../models/studentAtom');
const EducationTask = require('../models/educationTask');
const UserProfile = require('../models/userProfile');
const Task = require('../models/task');
const LessonPlan = require('../models/lessonPlan');
const { uploadFileToAzureBlobStorage } = require('../utilities/AzureBlobImages');
const studentTaskControllerFactory = require('./studentTaskController');

const STUDENT_ID = '507f1f77bcf86cd799439011';
const TASK_ID = '507f1f77bcf86cd799439012';
const LESSON_PLAN_ID = '507f1f77bcf86cd799439013';
const ASSIGNMENT_ID = '507f1f77bcf86cd799439018';

const ALLOWED_REQUESTOR = { role: 'Administrator', requestorId: STUDENT_ID };

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnThis();
  res.json = jest.fn().mockReturnThis();
  res.send = jest.fn().mockReturnThis();
  return res;
};

const selectResolves = (value) => ({ select: jest.fn().mockResolvedValue(value) });

// Builds a thenable query-chain mock that supports repeated .populate() calls
// and resolves to `result` when awaited, mirroring mongoose's chainable Query API.
const makePopulateChain = (result) => {
  const chain = {};
  chain.populate = jest.fn().mockReturnValue(chain);
  chain.then = (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected);
  chain.catch = (onRejected) => Promise.resolve(result).catch(onRejected);
  return chain;
};

describe('studentTaskController', () => {
  let controller;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = studentTaskControllerFactory();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createStudentTask', () => {
    const buildReq = (overrides = {}) => ({
      body: {
        requestor: ALLOWED_REQUESTOR,
        studentId: STUDENT_ID,
        taskId: TASK_ID,
        lessonPlanId: LESSON_PLAN_ID,
        ...overrides,
      },
    });

    it('returns 403 when the requestor lacks an allowed role', async () => {
      const req = buildReq({ requestor: { role: 'Student' } });
      const res = makeRes();

      await controller.createStudentTask(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(UserProfile.findById).not.toHaveBeenCalled();
    });

    it('returns 400 when studentId, taskId, or lessonPlanId is missing', async () => {
      const req = buildReq({ studentId: undefined });
      const res = makeRes();

      await controller.createStudentTask(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'studentId, taskId, and lessonPlanId are required',
      });
    });

    it('returns 400 when an id field is not a valid ObjectId', async () => {
      const req = buildReq({ studentId: 'not-a-valid-id' });
      const res = makeRes();

      await controller.createStudentTask(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'studentId is not a valid id' });
    });

    it('returns 400 when deadlineOffsetDays is not a number', async () => {
      const req = buildReq({ deadlineOffsetDays: 'soon' });
      const res = makeRes();

      await controller.createStudentTask(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'deadlineOffsetDays must be a number' });
    });

    it('returns 404 when the student does not exist', async () => {
      UserProfile.findById.mockReturnValue(selectResolves(null));
      Task.findById.mockReturnValue(selectResolves({ _id: TASK_ID }));
      LessonPlan.findById.mockReturnValue(selectResolves({ _id: LESSON_PLAN_ID }));
      const req = buildReq();
      const res = makeRes();

      await controller.createStudentTask(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'studentId does not exist' });
    });

    it('returns 404 when the task does not exist', async () => {
      UserProfile.findById.mockReturnValue(selectResolves({ _id: STUDENT_ID }));
      Task.findById.mockReturnValue(selectResolves(null));
      LessonPlan.findById.mockReturnValue(selectResolves({ _id: LESSON_PLAN_ID }));
      const req = buildReq();
      const res = makeRes();

      await controller.createStudentTask(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'taskId does not exist' });
    });

    it('returns 404 when the lesson plan does not exist', async () => {
      UserProfile.findById.mockReturnValue(selectResolves({ _id: STUDENT_ID }));
      Task.findById.mockReturnValue(selectResolves({ _id: TASK_ID }));
      LessonPlan.findById.mockReturnValue(selectResolves(null));
      const req = buildReq();
      const res = makeRes();

      await controller.createStudentTask(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'lessonPlanId does not exist' });
    });

    it('returns 409 when the student is already assigned this task', async () => {
      UserProfile.findById.mockReturnValue(selectResolves({ _id: STUDENT_ID }));
      Task.findById.mockReturnValue(selectResolves({ _id: TASK_ID }));
      LessonPlan.findById.mockReturnValue(selectResolves({ _id: LESSON_PLAN_ID }));
      StudentTask.findOne.mockResolvedValue({ _id: ASSIGNMENT_ID });
      const req = buildReq();
      const res = makeRes();

      await controller.createStudentTask(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        error: 'This task is already assigned to this student',
      });
    });

    it('creates and saves the assignment, computing the deadline from the offset', async () => {
      UserProfile.findById.mockReturnValue(selectResolves({ _id: STUDENT_ID }));
      Task.findById.mockReturnValue(selectResolves({ _id: TASK_ID }));
      LessonPlan.findById.mockReturnValue(selectResolves({ _id: LESSON_PLAN_ID }));
      StudentTask.findOne.mockResolvedValue(null);
      const req = buildReq({ deadlineOffsetDays: 3 });
      const res = makeRes();

      await controller.createStudentTask(req, res);

      expect(StudentTask).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: STUDENT_ID,
          taskId: TASK_ID,
          lessonPlanId: LESSON_PLAN_ID,
          status: 'incomplete',
        }),
      );
      expect(res.status).toHaveBeenCalledWith(201);
      const jsonArg = res.json.mock.calls[0][0];
      expect(jsonArg.message).toBe('Task assigned successfully');
      const deadlineMs = new Date(jsonArg.assignment.deadline).getTime();
      const timestampMs = new Date(jsonArg.assignment.assignment_timestamp).getTime();
      const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
      expect(Math.abs(deadlineMs - timestampMs - threeDaysMs)).toBeLessThan(5000);
    });

    it('returns 500 when an unexpected error occurs', async () => {
      UserProfile.findById.mockImplementation(() => {
        throw new Error('DB unavailable');
      });
      const req = buildReq();
      const res = makeRes();

      await controller.createStudentTask(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'DB unavailable' });
    });
  });

  describe('getAllStudentTasks', () => {
    it('returns 403 when the requestor lacks access', async () => {
      const req = { body: { requestor: { role: 'Student' } } };
      const res = makeRes();

      await controller.getAllStudentTasks(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(StudentTask.find).not.toHaveBeenCalled();
    });

    it('returns all tasks on success', async () => {
      const tasks = [{ _id: ASSIGNMENT_ID }];
      StudentTask.find.mockResolvedValue(tasks);
      const req = { body: { requestor: ALLOWED_REQUESTOR } };
      const res = makeRes();

      await controller.getAllStudentTasks(req, res);

      expect(StudentTask.find).toHaveBeenCalledWith();
      expect(res.json).toHaveBeenCalledWith(tasks);
    });

    it('returns 500 when the query fails', async () => {
      StudentTask.find.mockRejectedValue(new Error('boom'));
      const req = { body: { requestor: ALLOWED_REQUESTOR } };
      const res = makeRes();

      await controller.getAllStudentTasks(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'boom' });
    });
  });

  describe('getTasksByStudent', () => {
    it('returns 403 when the requestor lacks access', async () => {
      const req = { body: { requestor: { role: 'Student' } }, params: { studentId: STUDENT_ID } };
      const res = makeRes();

      await controller.getTasksByStudent(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('returns 400 for an invalid studentId param', async () => {
      const req = {
        body: { requestor: ALLOWED_REQUESTOR },
        params: { studentId: 'invalid' },
      };
      const res = makeRes();

      await controller.getTasksByStudent(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'studentId is not a valid id' });
    });

    it('returns tasks scoped to the student', async () => {
      const tasks = [{ _id: ASSIGNMENT_ID, studentId: STUDENT_ID }];
      StudentTask.find.mockResolvedValue(tasks);
      const req = {
        body: { requestor: ALLOWED_REQUESTOR },
        params: { studentId: STUDENT_ID },
      };
      const res = makeRes();

      await controller.getTasksByStudent(req, res);

      expect(StudentTask.find).toHaveBeenCalledWith({ studentId: STUDENT_ID });
      expect(res.json).toHaveBeenCalledWith(tasks);
    });

    it('returns 500 when the query fails', async () => {
      StudentTask.find.mockRejectedValue(new Error('boom'));
      const req = {
        body: { requestor: ALLOWED_REQUESTOR },
        params: { studentId: STUDENT_ID },
      };
      const res = makeRes();

      await controller.getTasksByStudent(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('updateStudentTask', () => {
    const buildReq = (overrides = {}) => ({
      body: { requestor: ALLOWED_REQUESTOR, status: 'in_progress', ...overrides.body },
      params: { id: ASSIGNMENT_ID, ...overrides.params },
    });

    it('returns 403 when the requestor lacks access', async () => {
      const req = buildReq({ body: { requestor: { role: 'Student' } } });
      const res = makeRes();

      await controller.updateStudentTask(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('returns 400 for an invalid id param', async () => {
      const req = buildReq({ params: { id: 'invalid' } });
      const res = makeRes();

      await controller.updateStudentTask(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'id is not a valid id' });
    });

    it('returns 400 for an unrecognized status value', async () => {
      const req = buildReq({ body: { status: 'not_a_status' } });
      const res = makeRes();

      await controller.updateStudentTask(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json.mock.calls[0][0].error).toMatch(/status must be one of/);
    });

    it('returns 404 when the task is not found', async () => {
      StudentTask.findByIdAndUpdate.mockResolvedValue(null);
      const req = buildReq();
      const res = makeRes();

      await controller.updateStudentTask(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Task not found' });
    });

    it('updates the task without touching StudentAtom when status is not completed', async () => {
      const updatedTask = {
        _id: ASSIGNMENT_ID,
        studentId: STUDENT_ID,
        taskId: TASK_ID,
        status: 'in_progress',
      };
      StudentTask.findByIdAndUpdate.mockResolvedValue(updatedTask);
      const req = buildReq({ body: { status: 'in_progress' } });
      const res = makeRes();

      await controller.updateStudentTask(req, res);

      expect(StudentAtom.findOneAndUpdate).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        message: 'Task updated successfully',
        task: updatedTask,
      });
    });

    it('upserts a completed StudentAtom when status transitions to completed', async () => {
      const updatedTask = {
        _id: ASSIGNMENT_ID,
        studentId: STUDENT_ID,
        taskId: TASK_ID,
        status: 'completed',
      };
      StudentTask.findByIdAndUpdate.mockResolvedValue(updatedTask);
      StudentAtom.findOneAndUpdate.mockResolvedValue({});
      const req = buildReq({ body: { status: 'completed' } });
      const res = makeRes();

      await controller.updateStudentTask(req, res);

      expect(StudentAtom.findOneAndUpdate).toHaveBeenCalledWith(
        { studentId: STUDENT_ID, atomId: TASK_ID },
        expect.objectContaining({ status: 'completed' }),
        { upsert: true, new: true },
      );
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Task updated successfully' }),
      );
    });

    it('returns 500 when the update fails', async () => {
      StudentTask.findByIdAndUpdate.mockRejectedValue(new Error('update failed'));
      const req = buildReq();
      const res = makeRes();

      await controller.updateStudentTask(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'update failed' });
    });
  });

  describe('getStudentTasks', () => {
    it('returns 400 when the requestor has no requestorId', async () => {
      const req = { body: { requestor: {} } };
      const res = makeRes();

      await controller.getStudentTasks(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Student ID is required' });
      expect(EducationTask.aggregate).not.toHaveBeenCalled();
    });

    it('groups tasks by subject/color/activity and computes progress', async () => {
      const aggregateResult = [
        {
          _id: 'task-1',
          status: 'completed',
          subject: { name: 'Math' },
          color_level: 'green',
          activity_group: 'Group A',
        },
        {
          _id: 'task-2',
          status: 'incomplete',
          subject: { name: 'Math' },
          color_level: 'green',
          activity_group: 'Group A',
        },
      ];
      EducationTask.aggregate.mockResolvedValue(aggregateResult);
      const req = { body: { requestor: { requestorId: STUDENT_ID } } };
      const res = makeRes();

      await controller.getStudentTasks(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const payload = res.json.mock.calls[0][0];
      expect(payload.totalTasks).toBe(2);
      expect(payload.progress).toEqual({
        totalTasks: 2,
        completedTasks: 1,
        progressPercent: 50,
        statusBreakdown: { completed: 1, incomplete: 1 },
      });
      expect(payload.tasks.Math.colorLevels.green.activityGroups['Group A'].tasks).toHaveLength(2);
    });

    it('returns zeroed progress when there are no tasks', async () => {
      EducationTask.aggregate.mockResolvedValue([]);
      const req = { body: { requestor: { requestorId: STUDENT_ID } } };
      const res = makeRes();

      await controller.getStudentTasks(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          totalTasks: 0,
          progress: {
            totalTasks: 0,
            completedTasks: 0,
            progressPercent: 0,
            statusBreakdown: {},
          },
        }),
      );
    });

    it('returns 500 when the aggregation fails', async () => {
      EducationTask.aggregate.mockRejectedValue(new Error('aggregation failed'));
      const req = { body: { requestor: { requestorId: STUDENT_ID } } };
      const res = makeRes();

      await controller.getStudentTasks(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Internal server error',
        details: 'aggregation failed',
      });
    });
  });

  describe('updateTaskProgress', () => {
    const buildReq = (overrides = {}) => ({
      params: { taskId: TASK_ID, ...overrides.params },
      body: { requestor: { requestorId: STUDENT_ID }, progressPercent: 50, ...overrides.body },
    });

    it('returns 400 when neither taskId nor progress data is provided', async () => {
      const req = buildReq({ params: { taskId: undefined }, body: { progressPercent: undefined } });
      const res = makeRes();

      await controller.updateTaskProgress(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(EducationTask.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('clamps progressPercent into the 0-100 range and returns the populated task', async () => {
      const updatedTask = { _id: TASK_ID, progressPercent: 100 };
      EducationTask.findOneAndUpdate.mockReturnValue(makePopulateChain(updatedTask));
      const req = buildReq({ body: { progressPercent: 150 } });
      const res = makeRes();

      await controller.updateTaskProgress(req, res);

      expect(EducationTask.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ _id: expect.anything(), studentId: expect.anything() }),
        expect.objectContaining({ progressPercent: 100 }),
        { new: true },
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Task progress updated successfully',
        task: updatedTask,
      });
    });

    it('returns 404 when the task is not found', async () => {
      EducationTask.findOneAndUpdate.mockReturnValue(makePopulateChain(null));
      const req = buildReq();
      const res = makeRes();

      await controller.updateTaskProgress(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Student task not found' });
    });

    it('returns 500 on unexpected errors', async () => {
      EducationTask.findOneAndUpdate.mockImplementation(() => {
        throw new Error('db error');
      });
      const req = buildReq();
      const res = makeRes();

      await controller.updateTaskProgress(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('uploadFile', () => {
    const buildReq = (overrides = {}) => ({
      params: { taskId: TASK_ID },
      header: jest.fn().mockReturnValue('valid-token'),
      body: {},
      ...overrides,
    });

    beforeEach(() => {
      jwt.verify.mockReturnValue({ userid: STUDENT_ID });
    });

    it('returns 401 when the auth token is invalid', async () => {
      jwt.verify.mockImplementation(() => {
        throw new Error('bad token');
      });
      const req = buildReq();
      const res = makeRes();

      await controller.uploadFile(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.send).toHaveBeenCalledWith('Invalid token');
    });

    it('returns 400 when taskId is missing', async () => {
      const req = buildReq({ params: { taskId: undefined } });
      const res = makeRes();

      await controller.uploadFile(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Task ID are required' });
    });

    it('returns 400 when the token payload has no studentId', async () => {
      jwt.verify.mockReturnValue({ userid: undefined });
      const req = buildReq();
      const res = makeRes();

      await controller.uploadFile(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Student ID are required' });
    });

    it('returns 404 when the task cannot be found for this student', async () => {
      EducationTask.findOne.mockResolvedValue(null);
      const req = buildReq({ body: { url: 'https://example.com/file.pdf' } });
      const res = makeRes();

      await controller.uploadFile(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Task not found' });
    });

    it('returns 400 when the uploaded file exceeds the 10 MB limit', async () => {
      EducationTask.findOne.mockResolvedValue({ uploadUrls: [], save: jest.fn() });
      const req = buildReq({ file: { size: 11 * 1024 * 1024, mimetype: 'application/pdf' } });
      const res = makeRes();

      await controller.uploadFile(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'File size exceeds 10 MB limit' });
    });

    it('returns 400 when the uploaded file has a disallowed mime type', async () => {
      EducationTask.findOne.mockResolvedValue({ uploadUrls: [], save: jest.fn() });
      const req = buildReq({ file: { size: 1024, mimetype: 'application/x-msdownload' } });
      const res = makeRes();

      await controller.uploadFile(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Invalid file type. Only PDF, DOCX, TXT, and images are allowed.',
      });
    });

    it('returns 400 when no file and an invalid url are provided', async () => {
      EducationTask.findOne.mockResolvedValue({ uploadUrls: [], save: jest.fn() });
      const req = buildReq({ body: { url: 'not-a-url' } });
      const res = makeRes();

      await controller.uploadFile(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Please enter a valid url' });
    });

    it('returns 400 when neither a file nor a url are provided', async () => {
      EducationTask.findOne.mockResolvedValue({ uploadUrls: [], save: jest.fn() });
      const req = buildReq();
      const res = makeRes();

      await controller.uploadFile(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'A File or a link is required.' });
    });

    it('uploads a valid file, marks the task completed, and returns the blob url', async () => {
      const task = { uploadUrls: [], save: jest.fn().mockResolvedValue(true) };
      EducationTask.findOne.mockResolvedValue(task);
      uploadFileToAzureBlobStorage.mockResolvedValue('https://blob.example.com/file.pdf');
      const req = buildReq({
        file: { size: 1024, mimetype: 'application/pdf', originalname: 'f.pdf' },
      });
      const res = makeRes();

      await controller.uploadFile(req, res);

      expect(uploadFileToAzureBlobStorage).toHaveBeenCalled();
      expect(task.status).toBe('completed');
      expect(task.uploadUrls).toContain('https://blob.example.com/file.pdf');
      expect(task.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        message: 'File uploaded successfully!',
        url: 'https://blob.example.com/file.pdf',
      });
    });

    it('accepts a valid url when no file is uploaded', async () => {
      const task = { uploadUrls: [], save: jest.fn().mockResolvedValue(true) };
      EducationTask.findOne.mockResolvedValue(task);
      const req = buildReq({ body: { url: 'https://example.com/file.pdf' } });
      const res = makeRes();

      await controller.uploadFile(req, res);

      expect(uploadFileToAzureBlobStorage).not.toHaveBeenCalled();
      expect(task.uploadUrls).toContain('https://example.com/file.pdf');
      expect(res.json).toHaveBeenCalledWith({
        message: 'File uploaded successfully!',
        url: 'https://example.com/file.pdf',
      });
    });

    it('returns 500 when an unexpected error occurs', async () => {
      EducationTask.findOne.mockRejectedValue(new Error('db down'));
      const req = buildReq({ body: { url: 'https://example.com/file.pdf' } });
      const res = makeRes();

      await controller.uploadFile(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal Server Error. Upload failed' });
    });
  });

  describe('logHours', () => {
    const buildReq = (overrides = {}) => ({
      params: { taskId: TASK_ID, ...overrides.params },
      body: { requestor: { requestorId: STUDENT_ID }, hours: 2, ...overrides.body },
    });

    it('returns 400 for an invalid taskId', async () => {
      const req = buildReq({ params: { taskId: 'not-an-id' } });
      const res = makeRes();

      await controller.logHours(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid Task ID' });
    });

    it('returns 400 for an invalid studentId', async () => {
      const req = buildReq({ body: { requestor: { requestorId: 'not-an-id' } } });
      const res = makeRes();

      await controller.logHours(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid Student ID' });
    });

    it('returns 400 when hours is not a positive number', async () => {
      const req = buildReq({ body: { hours: 0 } });
      const res = makeRes();

      await controller.logHours(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'hours must be a positive number' });
    });

    it('returns 404 when the task does not belong to the student', async () => {
      EducationTask.findOne.mockResolvedValue(null);
      const req = buildReq();
      const res = makeRes();

      await controller.logHours(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Task not found or does not belong to you' });
    });

    it('returns 400 when the task is already completed', async () => {
      EducationTask.findOne.mockResolvedValue({
        status: 'completed',
        loggedHours: 5,
        suggestedTotalHours: 10,
      });
      const req = buildReq();
      const res = makeRes();

      await controller.logHours(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Cannot log hours for a completed task' });
    });

    it('caps loggedHours at suggestedTotalHours and flips status to in_progress', async () => {
      EducationTask.findOne.mockResolvedValue({
        status: 'assigned',
        loggedHours: 8,
        suggestedTotalHours: 10,
      });
      EducationTask.findOneAndUpdate.mockResolvedValue({
        loggedHours: 10,
        suggestedTotalHours: 10,
        status: 'in_progress',
      });
      const req = buildReq({ body: { hours: 5 } });
      const res = makeRes();

      await controller.logHours(req, res);

      expect(EducationTask.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ _id: expect.anything() }),
        { $set: { loggedHours: 10, status: 'in_progress' } },
        { new: true, runValidators: false },
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Hours logged successfully',
        loggedHours: 10,
        suggestedTotalHours: 10,
        status: 'in_progress',
        canMarkDone: true,
      });
    });

    it('returns 404 when the update finds no matching task', async () => {
      EducationTask.findOne.mockResolvedValue({
        status: 'assigned',
        loggedHours: 0,
        suggestedTotalHours: 10,
      });
      EducationTask.findOneAndUpdate.mockResolvedValue(null);
      const req = buildReq();
      const res = makeRes();

      await controller.logHours(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Task not found during update' });
    });

    it('returns 500 when an unexpected error occurs', async () => {
      EducationTask.findOne.mockRejectedValue(new Error('db down'));
      const req = buildReq();
      const res = makeRes();

      await controller.logHours(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });
  });
});
