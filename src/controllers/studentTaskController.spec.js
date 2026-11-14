const mongoose = require('mongoose');
const EducationTask = require('../models/educationTask');
const { mockReq, mockRes } = require('../test');
const studentTaskController = require('./studentTaskController');

const VALID_TASK_ID = '507f1f77bcf86cd799439011';
const VALID_STUDENT_ID = '65cf6c3706d8ac105827bb2e';

// Shared helpers to reduce repetition
const makeTask = (overrides = {}) => ({
  type: 'read',
  status: 'assigned',
  loggedHours: 0,
  suggestedTotalHours: 5,
  ...overrides,
});

const makeUpdated = (overrides = {}) => ({
  type: 'read',
  loggedHours: 1,
  suggestedTotalHours: 5,
  status: 'in_progress',
  ...overrides,
});

const spyFindOne = (result) => jest.spyOn(EducationTask, 'findOne').mockResolvedValueOnce(result);
const spyFindOneAndUpdate = (result) =>
  jest.spyOn(EducationTask, 'findOneAndUpdate').mockResolvedValueOnce(result);

describe('studentTaskController - logHours', () => {
  let logHours;

  beforeEach(() => {
    logHours = studentTaskController().logHours;
    mockReq.params = { taskId: VALID_TASK_ID };
    mockReq.user = { requestorId: VALID_STUDENT_ID };
    mockReq.body = { hours: 1 };
    jest.spyOn(EducationTask, 'findOne').mockResolvedValue(null);
    jest.spyOn(EducationTask, 'findOneAndUpdate').mockResolvedValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('Input validation', () => {
    test('Does not accept body requestor as authentication', async () => {
      mockReq.user = undefined;
      mockReq.body.requestor = { requestorId: VALID_STUDENT_ID };
      await logHours(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(EducationTask.findOne).not.toHaveBeenCalled();
      expect(EducationTask.findOneAndUpdate).not.toHaveBeenCalled();
    });

    test.each(['1', NaN, Infinity, -Infinity, null, undefined, true])(
      'Rejects non-finite or nonnumeric hours: %s',
      async (hours) => {
        mockReq.body.hours = hours;
        await logHours(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'hours must be a positive number' });
        expect(EducationTask.findOne).not.toHaveBeenCalled();
        expect(EducationTask.findOneAndUpdate).not.toHaveBeenCalled();
      },
    );

    test.each([
      ['taskId is missing', { params: { taskId: '' } }, 400, { error: 'Invalid Task ID' }],
      [
        'taskId is not a valid ObjectId',
        { params: { taskId: 'bad-id' } },
        400,
        { error: 'Invalid Task ID' },
      ],
      ['studentId is missing', { user: undefined }, 401, { error: 'Authentication required' }],
      [
        'studentId is not a valid ObjectId',
        { user: { requestorId: 'bad' } },
        400,
        { error: 'Invalid Student ID' },
      ],
      ['hours is zero', { body: { hours: 0 } }, 400, { error: 'hours must be a positive number' }],
      [
        'hours is negative',
        { body: { hours: -1 } },
        400,
        { error: 'hours must be a positive number' },
      ],
      [
        'hours is not a number',
        { body: { hours: 'abc' } },
        400,
        { error: 'hours must be a positive number' },
      ],
    ])('Rejects input when %s', async (_, reqOverrides, expectedStatus, expectedBody) => {
      Object.assign(mockReq, reqOverrides);
      if (reqOverrides.params) Object.assign(mockReq.params, reqOverrides.params);
      await logHours(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(expectedStatus);
      expect(mockRes.json).toHaveBeenCalledWith(expectedBody);
      expect(EducationTask.findOne).not.toHaveBeenCalled();
      expect(EducationTask.findOneAndUpdate).not.toHaveBeenCalled();
    });
  });

  describe('Database interactions', () => {
    test('Uses the authenticated owner rather than a supplied body identity', async () => {
      mockReq.body.requestor = { requestorId: VALID_TASK_ID };
      mockReq.body.studentId = VALID_TASK_ID;
      await logHours(mockReq, mockRes);
      expect(EducationTask.findOne).toHaveBeenCalledWith({
        _id: mongoose.Types.ObjectId(VALID_TASK_ID),
        studentId: mongoose.Types.ObjectId(VALID_STUDENT_ID),
      });
      expect(EducationTask.findOneAndUpdate).not.toHaveBeenCalled();
    });

    test.each(['practice', 'quiz', 'project', undefined])(
      'Rejects task type %s without updating',
      async (type) => {
        spyFindOne(makeTask({ type }));
        await logHours(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'Only read and write tasks support hours logging',
        });
        expect(EducationTask.findOneAndUpdate).not.toHaveBeenCalled();
      },
    );

    test('Returns 404 if task is not found', async () => {
      spyFindOne(null);
      await logHours(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Task not found or does not belong to you',
      });
    });

    test.each([
      ['completed', makeTask({ status: 'completed', loggedHours: 3 })],
      ['graded', makeTask({ status: 'graded', loggedHours: 5 })],
      ['completed write', makeTask({ type: 'write', status: 'completed', loggedHours: 5 })],
      ['graded write', makeTask({ type: 'write', status: 'graded', loggedHours: 5 })],
      ['Assigned', makeTask({ status: 'Assigned' })],
    ])('Returns 400 if task status is %s', async (_, task) => {
      spyFindOne(task);
      await logHours(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Cannot log hours for a task with this status',
      });
      expect(EducationTask.findOneAndUpdate).not.toHaveBeenCalled();
    });

    test.each(['read', 'write'])('Transitions an assigned %s task to in_progress', async (type) => {
      spyFindOne(makeTask({ type }));
      spyFindOneAndUpdate(makeUpdated({ type }));
      await logHours(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Hours logged successfully',
        loggedHours: 1,
        suggestedTotalHours: 5,
        status: 'in_progress',
        canMarkDone: false,
      });
    });

    test.each(['read', 'write'])('Caps %s hours without completing the task', async (type) => {
      mockReq.body.hours = 3;
      spyFindOne(makeTask({ type, status: 'in_progress', loggedHours: 4 }));
      spyFindOneAndUpdate(makeUpdated({ type, loggedHours: 5 }));
      await logHours(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Hours logged successfully',
        loggedHours: 5,
        suggestedTotalHours: 5,
        status: 'in_progress',
        canMarkDone: type === 'read',
      });
      expect(EducationTask.findOneAndUpdate).toHaveBeenCalledWith(
        {
          _id: mongoose.Types.ObjectId(VALID_TASK_ID),
          studentId: mongoose.Types.ObjectId(VALID_STUDENT_ID),
          type,
          status: { $in: ['assigned', 'in_progress'] },
        },
        [
          {
            $set: {
              loggedHours: {
                $cond: [
                  { $gt: [{ $ifNull: ['$suggestedTotalHours', 0] }, 0] },
                  {
                    $min: [
                      { $add: [{ $ifNull: ['$loggedHours', 0] }, 3] },
                      { $ifNull: ['$suggestedTotalHours', 0] },
                    ],
                  },
                  { $add: [{ $ifNull: ['$loggedHours', 0] }, 3] },
                ],
              },
              status: 'in_progress',
            },
          },
        ],
        { new: true },
      );
    });

    test.each(['read', 'write'])(
      'Returns 409 if %s eligibility changes before updating',
      async (type) => {
        spyFindOne(makeTask({ type }));
        spyFindOneAndUpdate(null);
        await logHours(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(409);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'Task changed and is no longer eligible for logging',
        });
      },
    );

    test.each(['read', 'write'])(
      'Returns canMarkDone false for %s with no hours target',
      async (type) => {
        spyFindOne(makeTask({ type, suggestedTotalHours: 0 }));
        spyFindOneAndUpdate(makeUpdated({ type, suggestedTotalHours: 0 }));
        await logHours(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ canMarkDone: false }));
      },
    );

    test('Returns 500 if findOne throws an error', async () => {
      EducationTask.findOne.mockRejectedValueOnce(new Error('DB error'));
      await logHours(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });
  });
});
