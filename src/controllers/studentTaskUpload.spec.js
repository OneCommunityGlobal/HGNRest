jest.mock('../utilities/AzureBlobImages', () => ({ uploadFileToAzureBlobStorage: jest.fn() }));

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const EducationTask = require('../models/educationTask');
const { uploadFileToAzureBlobStorage } = require('../utilities/AzureBlobImages');
const studentTaskController = require('./studentTaskController');

const taskId = '507f1f77bcf86cd799439011';
const studentId = '65cf6c3706d8ac105827bb2e';
const url = 'https://example.com/submission.pdf';
let req;
let res;
let task;
let uploadFile;

beforeEach(() => {
  req = {
    params: { taskId },
    header: jest.fn().mockReturnValue('test-token'),
    body: {},
    file: { originalname: 'submission.pdf', mimetype: 'application/pdf', size: 100 },
  };
  res = { status: jest.fn().mockReturnThis(), json: jest.fn(), send: jest.fn() };
  task = {
    type: 'write',
    status: 'in_progress',
    loggedHours: 2,
    suggestedTotalHours: 5,
    uploadUrls: ['https://example.com/previous.pdf'],
    save: jest.fn().mockResolvedValue(),
  };
  jest.spyOn(jwt, 'verify').mockReturnValue({ userid: studentId });
  jest.spyOn(EducationTask, 'findOne').mockResolvedValue(task);
  jest.spyOn(console, 'error').mockImplementation(() => {});
  uploadFileToAzureBlobStorage.mockResolvedValue(url);
  uploadFile = studentTaskController().uploadFile;
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

test.each(['assigned', 'in_progress'])(
  'persists completion only after uploading an %s write task',
  async (status) => {
    task.status = status;
    uploadFileToAzureBlobStorage.mockImplementation(async () => {
      expect(task.status).toBe(status);
      expect(task.save).not.toHaveBeenCalled();
      return url;
    });
    task.save.mockImplementation(async () => {
      expect(task.status).toBe('completed');
      expect(task.loggedHours).toBe(5);
      expect(task.completedAt).toEqual(expect.any(Number));
      expect(task.uploadUrls).toEqual(['https://example.com/previous.pdf', url]);
    });
    await uploadFile(req, res);
    expect(uploadFileToAzureBlobStorage).toHaveBeenCalledWith(
      req.file,
      expect.stringContaining(`tasks/${taskId}/${studentId}/submission.pdf-`),
    );
    expect(task.save).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith({
      message: 'File uploaded successfully!',
      url,
      status: 'completed',
      loggedHours: 5,
      suggestedTotalHours: 5,
      completedAt: task.completedAt,
      uploadUrls: task.uploadUrls,
    });
  },
);

test('rejects invalid authentication before accessing tasks', async () => {
  jwt.verify.mockImplementation(() => {
    throw new Error('Invalid token');
  });
  await uploadFile(req, res);
  expect(res.status).toHaveBeenCalledWith(401);
  expect(EducationTask.findOne).not.toHaveBeenCalled();
  expect(uploadFileToAzureBlobStorage).not.toHaveBeenCalled();
});

test('uses token ownership and rejects tasks not owned by the authenticated user', async () => {
  req.body.studentId = taskId;
  EducationTask.findOne.mockResolvedValue(null);
  await uploadFile(req, res);
  expect(EducationTask.findOne).toHaveBeenCalledWith({
    _id: mongoose.Types.ObjectId(taskId),
    studentId: mongoose.Types.ObjectId(studentId),
  });
  expect(res.status).toHaveBeenCalledWith(404);
  expect(uploadFileToAzureBlobStorage).not.toHaveBeenCalled();
  expect(task.save).not.toHaveBeenCalled();
});

test.each([
  ['read', 'assigned'],
  ['practice', 'assigned'],
  ['quiz', 'assigned'],
  ['project', 'assigned'],
  ['write', 'completed'],
  ['write', 'graded'],
  ['write', 'unknown'],
])('rejects ineligible %s tasks with status %s', async (type, status) => {
  Object.assign(task, { type, status });
  await uploadFile(req, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(uploadFileToAzureBlobStorage).not.toHaveBeenCalled();
  expect(task.save).not.toHaveBeenCalled();
});

test.each([undefined, null, -1, NaN, Infinity])(
  'rejects invalid suggested hours %s',
  async (hours) => {
    task.suggestedTotalHours = hours;
    await uploadFile(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(uploadFileToAzureBlobStorage).not.toHaveBeenCalled();
    expect(task.save).not.toHaveBeenCalled();
  },
);

test.each([
  { size: 10 * 1024 * 1024 + 1, mimetype: 'application/pdf' },
  { size: 100, mimetype: 'application/javascript' },
  undefined,
])('rejects invalid or missing files without completing', async (file) => {
  req.file = file;
  await uploadFile(req, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(uploadFileToAzureBlobStorage).not.toHaveBeenCalled();
  expect(task.save).not.toHaveBeenCalled();
  expect(task.status).toBe('in_progress');
});

test.each(['reject', 'empty'])(
  'does not complete or save when storage returns %s',
  async (failure) => {
    if (failure === 'reject')
      uploadFileToAzureBlobStorage.mockRejectedValue(new Error('Storage failed'));
    else uploadFileToAzureBlobStorage.mockResolvedValue(null);
    await uploadFile(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(task.save).not.toHaveBeenCalled();
    expect(task.status).toBe('in_progress');
    expect(task.loggedHours).toBe(2);
    expect(task.completedAt).toBeUndefined();
    expect(task.uploadUrls).toHaveLength(1);
  },
);

test('does not report success if completion persistence fails', async () => {
  task.save.mockRejectedValue(new Error('Save failed'));
  await uploadFile(req, res);
  expect(res.status).toHaveBeenCalledWith(500);
  expect(res.json).toHaveBeenCalledWith({ error: 'Internal Server Error. Upload failed' });
});

test('preserves link submissions and supports a zero hours target', async () => {
  req.file = undefined;
  req.body.url = url;
  task.suggestedTotalHours = 0;
  await uploadFile(req, res);
  expect(uploadFileToAzureBlobStorage).not.toHaveBeenCalled();
  expect(task.save).toHaveBeenCalledTimes(1);
  expect(res.json).toHaveBeenCalledWith(
    expect.objectContaining({ status: 'completed', loggedHours: 0, url }),
  );
});
