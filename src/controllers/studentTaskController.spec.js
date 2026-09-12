const EducationTask = require('../models/educationTask');
const { mockReq, mockRes } = require('../test');
const studentTaskController = require('./studentTaskController');

const VALID_TASK_ID = '507f1f77bcf86cd799439011';
const VALID_STUDENT_ID = '65cf6c3706d8ac105827bb2e';

// Shared helpers to reduce repetition
const makeTask = (overrides = {}) => ({
  status: 'assigned',
  loggedHours: 0,
  suggestedTotalHours: 5,
  ...overrides,
});

const makeUpdated = (overrides = {}) => ({
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
    mockReq.params.taskId = VALID_TASK_ID;
    mockReq.body.requestor = { requestorId: VALID_STUDENT_ID };
    mockReq.body.hours = 1;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Input validation', () => {
    test.each([
      ['taskId is missing', { params: { taskId: '' } }, 400, { error: 'Invalid Task ID' }],
      [
        'taskId is not a valid ObjectId',
        { params: { taskId: 'bad-id' } },
        400,
        { error: 'Invalid Task ID' },
      ],
      [
        'studentId is missing',
        { body: { requestor: {}, hours: 1 } },
        400,
        { error: 'Invalid Student ID' },
      ],
      [
        'studentId is not a valid ObjectId',
        { body: { requestor: { requestorId: 'bad' }, hours: 1 } },
        400,
        { error: 'Invalid Student ID' },
      ],
      [
        'hours is zero',
        { body: { requestor: { requestorId: VALID_STUDENT_ID }, hours: 0 } },
        400,
        { error: 'hours must be a positive number' },
      ],
      [
        'hours is negative',
        { body: { requestor: { requestorId: VALID_STUDENT_ID }, hours: -1 } },
        400,
        { error: 'hours must be a positive number' },
      ],
      [
        'hours is not a number',
        { body: { requestor: { requestorId: VALID_STUDENT_ID }, hours: 'abc' } },
        400,
        { error: 'hours must be a positive number' },
      ],
    ])('Returns %i when %s', async (_, reqOverrides, expectedStatus, expectedBody) => {
      Object.assign(mockReq, reqOverrides);
      if (reqOverrides.params) Object.assign(mockReq.params, reqOverrides.params);
      await logHours(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(expectedStatus);
      expect(mockRes.json).toHaveBeenCalledWith(expectedBody);
    });
  });

  describe('Database interactions', () => {
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
    ])('Returns 400 if task status is %s', async (_, task) => {
      spyFindOne(task);
      await logHours(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Cannot log hours for a completed task' });
    });

    test('Returns 200 and transitions assigned -> in_progress on first log', async () => {
      spyFindOne(makeTask());
      spyFindOneAndUpdate(makeUpdated());
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

    test('Returns 200 and caps loggedHours at suggestedTotalHours', async () => {
      mockReq.body.hours = 3;
      spyFindOne(makeTask({ status: 'in_progress', loggedHours: 4 }));
      spyFindOneAndUpdate(makeUpdated({ loggedHours: 5 }));
      await logHours(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Hours logged successfully',
        loggedHours: 5,
        suggestedTotalHours: 5,
        status: 'in_progress',
        canMarkDone: true,
      });
      expect(EducationTask.findOneAndUpdate).toHaveBeenCalledWith(
        expect.any(Object),
        { $set: { loggedHours: 5, status: 'in_progress' } },
        { new: true, runValidators: false },
      );
    });

    test('Returns 404 if findOneAndUpdate returns null', async () => {
      spyFindOne(makeTask());
      spyFindOneAndUpdate(null);
      await logHours(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Task not found during update' });
    });

    test('Returns 200 with canMarkDone false when suggestedTotalHours is 0', async () => {
      spyFindOne(makeTask({ suggestedTotalHours: 0 }));
      spyFindOneAndUpdate(makeUpdated({ suggestedTotalHours: 0 }));
      await logHours(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ canMarkDone: false }));
    });

    test('Returns 500 if findOne throws an error', async () => {
      spyFindOne(Promise.reject(new Error('DB error')));
      await logHours(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });
  });
});
