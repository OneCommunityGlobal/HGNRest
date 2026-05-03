const mongoose = require('mongoose');
const EducationTask = require('../models/educationTask');
const { mockReq, mockRes } = require('../test');
const studentTaskController = require('./studentTaskController');

const VALID_TASK_ID = '507f1f77bcf86cd799439011';
const VALID_STUDENT_ID = '65cf6c3706d8ac105827bb2e'; // matches mockReq.body.requestor.requestorId

const makeSut = () => {
  const { logHours } = studentTaskController();
  return { logHours };
};

const flushPromises = () => new Promise(setImmediate);

describe('studentTaskController - logHours', () => {
  beforeEach(() => {
    mockReq.params.taskId = VALID_TASK_ID;
    mockReq.body.requestor = { requestorId: VALID_STUDENT_ID };
    mockReq.body.hours = 1;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Input validation', () => {
    test('Returns 400 if taskId is missing', async () => {
      const { logHours } = makeSut();
      mockReq.params.taskId = '';
      await logHours(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid Task ID' });
    });

    test('Returns 400 if taskId is not a valid ObjectId', async () => {
      const { logHours } = makeSut();
      mockReq.params.taskId = 'not-an-objectid';
      await logHours(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid Task ID' });
    });

    test('Returns 400 if studentId is missing', async () => {
      const { logHours } = makeSut();
      mockReq.body.requestor = {};
      await logHours(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid Student ID' });
    });

    test('Returns 400 if studentId is not a valid ObjectId', async () => {
      const { logHours } = makeSut();
      mockReq.body.requestor = { requestorId: 'not-an-objectid' };
      await logHours(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid Student ID' });
    });

    test('Returns 400 if hours is zero', async () => {
      const { logHours } = makeSut();
      mockReq.body.hours = 0;
      await logHours(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'hours must be a positive number' });
    });

    test('Returns 400 if hours is negative', async () => {
      const { logHours } = makeSut();
      mockReq.body.hours = -1;
      await logHours(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'hours must be a positive number' });
    });

    test('Returns 400 if hours is not a number', async () => {
      const { logHours } = makeSut();
      mockReq.body.hours = 'abc';
      await logHours(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'hours must be a positive number' });
    });
  });

  describe('Database interactions', () => {
    test('Returns 404 if task is not found', async () => {
      const { logHours } = makeSut();
      jest.spyOn(EducationTask, 'findOne').mockResolvedValueOnce(null);
      await logHours(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Task not found or does not belong to you',
      });
    });

    test('Returns 400 if task status is completed', async () => {
      const { logHours } = makeSut();
      jest.spyOn(EducationTask, 'findOne').mockResolvedValueOnce({
        _id: mongoose.Types.ObjectId(VALID_TASK_ID),
        studentId: mongoose.Types.ObjectId(VALID_STUDENT_ID),
        status: 'completed',
        loggedHours: 3,
        suggestedTotalHours: 5,
      });
      await logHours(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Cannot log hours for a completed task' });
    });

    test('Returns 400 if task status is graded', async () => {
      const { logHours } = makeSut();
      jest.spyOn(EducationTask, 'findOne').mockResolvedValueOnce({
        _id: mongoose.Types.ObjectId(VALID_TASK_ID),
        studentId: mongoose.Types.ObjectId(VALID_STUDENT_ID),
        status: 'graded',
        loggedHours: 5,
        suggestedTotalHours: 5,
      });
      await logHours(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Cannot log hours for a completed task' });
    });

    test('Returns 200 and logs hours successfully for assigned task', async () => {
      const { logHours } = makeSut();
      jest.spyOn(EducationTask, 'findOne').mockResolvedValueOnce({
        _id: mongoose.Types.ObjectId(VALID_TASK_ID),
        studentId: mongoose.Types.ObjectId(VALID_STUDENT_ID),
        status: 'assigned',
        loggedHours: 0,
        suggestedTotalHours: 5,
      });
      jest.spyOn(EducationTask, 'findOneAndUpdate').mockResolvedValueOnce({
        _id: mongoose.Types.ObjectId(VALID_TASK_ID),
        loggedHours: 1,
        suggestedTotalHours: 5,
        status: 'in_progress',
      });
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
      const { logHours } = makeSut();
      mockReq.body.hours = 3;
      jest.spyOn(EducationTask, 'findOne').mockResolvedValueOnce({
        _id: mongoose.Types.ObjectId(VALID_TASK_ID),
        studentId: mongoose.Types.ObjectId(VALID_STUDENT_ID),
        status: 'in_progress',
        loggedHours: 4,
        suggestedTotalHours: 5,
      });
      jest.spyOn(EducationTask, 'findOneAndUpdate').mockResolvedValueOnce({
        _id: mongoose.Types.ObjectId(VALID_TASK_ID),
        loggedHours: 5,
        suggestedTotalHours: 5,
        status: 'in_progress',
      });
      await logHours(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Hours logged successfully',
        loggedHours: 5,
        suggestedTotalHours: 5,
        status: 'in_progress',
        canMarkDone: true,
      });
      // confirm the update was capped at 5, not 7
      expect(EducationTask.findOneAndUpdate).toHaveBeenCalledWith(
        expect.any(Object),
        { $set: { loggedHours: 5, status: 'in_progress' } },
        { new: true, runValidators: false },
      );
    });

    test('Returns 404 if findOneAndUpdate returns null', async () => {
      const { logHours } = makeSut();
      jest.spyOn(EducationTask, 'findOne').mockResolvedValueOnce({
        _id: mongoose.Types.ObjectId(VALID_TASK_ID),
        studentId: mongoose.Types.ObjectId(VALID_STUDENT_ID),
        status: 'assigned',
        loggedHours: 0,
        suggestedTotalHours: 5,
      });
      jest.spyOn(EducationTask, 'findOneAndUpdate').mockResolvedValueOnce(null);
      await logHours(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Task not found during update' });
    });

    test('Returns 200 with canMarkDone true when loggedHours meets suggestedTotalHours', async () => {
      const { logHours } = makeSut();
      jest.spyOn(EducationTask, 'findOne').mockResolvedValueOnce({
        _id: mongoose.Types.ObjectId(VALID_TASK_ID),
        studentId: mongoose.Types.ObjectId(VALID_STUDENT_ID),
        status: 'in_progress',
        loggedHours: 4,
        suggestedTotalHours: 5,
      });
      jest.spyOn(EducationTask, 'findOneAndUpdate').mockResolvedValueOnce({
        _id: mongoose.Types.ObjectId(VALID_TASK_ID),
        loggedHours: 5,
        suggestedTotalHours: 5,
        status: 'in_progress',
      });
      await logHours(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ canMarkDone: true }));
    });

    test('Returns 200 with canMarkDone false when suggestedTotalHours is 0', async () => {
      const { logHours } = makeSut();
      jest.spyOn(EducationTask, 'findOne').mockResolvedValueOnce({
        _id: mongoose.Types.ObjectId(VALID_TASK_ID),
        studentId: mongoose.Types.ObjectId(VALID_STUDENT_ID),
        status: 'assigned',
        loggedHours: 0,
        suggestedTotalHours: 0,
      });
      jest.spyOn(EducationTask, 'findOneAndUpdate').mockResolvedValueOnce({
        _id: mongoose.Types.ObjectId(VALID_TASK_ID),
        loggedHours: 1,
        suggestedTotalHours: 0,
        status: 'in_progress',
      });
      await logHours(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ canMarkDone: false }));
    });

    test('Returns 500 if findOne throws an error', async () => {
      const { logHours } = makeSut();
      jest.spyOn(EducationTask, 'findOne').mockRejectedValueOnce(new Error('DB error'));
      await logHours(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });
  });
});
