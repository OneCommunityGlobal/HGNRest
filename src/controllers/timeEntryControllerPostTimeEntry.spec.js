jest.mock('../utilities/permissions', () => ({
  hasPermission: jest.fn(),
}));
jest.mock('../models/userProfile');
jest.mock('../models/project');
jest.mock('../models/task');
jest.mock('../models/wbs');
jest.mock('../utilities/emailSender');
jest.mock('../utilities/nodeCache', () =>
  jest.fn(() => ({
    removeCache: jest.fn(),
    setCache: jest.fn(),
    getCache: jest.fn(),
  })),
);

const helper = require('../utilities/permissions');
const UserProfile = require('../models/userProfile');
const Project = require('../models/project');
const Task = require('../models/task');
const WBS = require('../models/wbs');
const emailSender = require('../utilities/emailSender');
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const timeEntryController = require('./timeEntryController');

// ───── MONGOOSE SESSION MOCK ─────────────────────────────────
jest.spyOn(mongoose.Connection.prototype, 'startSession').mockImplementation(() => ({
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  abortTransaction: jest.fn(),
  endSession: jest.fn(),
}));

// ───── TIMEENTRY MOCK STATIC METHODS ─────────────────────────
const TimeEntry = jest.fn().mockImplementation(() => ({
  save: jest.fn(),
  remove: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));
TimeEntry.findById = jest.fn();
TimeEntry.findOne = jest.fn();
TimeEntry.find = jest.fn().mockReturnValue({
  populate: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
  lean: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue([
    {
      _id: 'entry1',
      personId: { _id: 'user1', name: 'Test User' },
      projectId: { _id: 'proj1', projectName: 'Test Project', category: 'Category' },
      taskId: { _id: 'task1', taskName: 'Test Task', classification: 'Classification' },
      wbsId: { _id: 'wbs1', wbsName: 'Test WBS' },
      totalSeconds: 7200,
    },
  ]),
});

// ───── POST TIME ENTRY TEST BLOCK ────────────────────────────
describe('TimeEntryController - postTimeEntry', () => {
  let controller;
  let req, res;

  beforeEach(() => {
    const TimeEntry = function () {
      return {
        save: jest.fn().mockResolvedValue({ _id: 'time1', totalSeconds: 5400 }),
      };
    };

    controller = timeEntryController(TimeEntry);

    req = {
      body: {
        personId: 'user1',
        projectId: 'proj1',
        hours: 1,
        minutes: 30,
        dateOfWork: moment().format('YYYY-MM-DD'),
        notes: 'Worked on something important',
        isTangible: true,
        entryType: 'default',
        requestor: { requestorId: 'user1' },
      },
    };

    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should post a time entry successfully for self', async () => {
    helper.hasPermission.mockResolvedValue(true);

    UserProfile.findById.mockResolvedValue({
      _id: 'user1',
      isFirstTimelog: false,
      startDate: '2024-01-01',
      hoursByCategory: { default: 0 },
      totalTangibleHrs: 0,
      totalIntangibleHrs: 0,
      save: jest.fn().mockResolvedValue(),
    });

    Project.findById.mockResolvedValue({
      _id: 'proj1',
      category: 'default',
    });

    const TimeEntry = function (data) {
      return {
        ...data,
        save: jest.fn().mockResolvedValue({
          _id: 'entry1',
          totalSeconds: 5400,
        }),
      };
    };

    const controller = timeEntryController(TimeEntry);

    const req = {
      body: {
        personId: 'user1',
        projectId: 'proj1',
        hours: 1,
        minutes: 30,
        dateOfWork: moment().format('YYYY-MM-DD'),
        notes: 'Worked on something',
        isTangible: true,
        entryType: 'default',
        requestor: { requestorId: 'user1' },
      },
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    await controller.postTimeEntry(req, res);
  });

  it('should return 403 when posting for another user without permission', async () => {
    req.body.personId = 'user2';
    req.body.requestor.requestorId = 'user1';

    helper.hasPermission.mockResolvedValue(false);

    await controller.postTimeEntry(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.send).toHaveBeenCalledWith({
      error: 'You do not have permission to post time entries for others',
    });
  });

  it('should return 400 when required fields are missing', async () => {
    req.body.dateOfWork = undefined;

    helper.hasPermission.mockResolvedValue(true);

    await controller.postTimeEntry(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({ error: 'Bad request' });
  });

  it('should handle internal server errors', async () => {
    helper.hasPermission.mockResolvedValue(true);
    UserProfile.findById.mockRejectedValue(new Error('DB failure'));

    await controller.postTimeEntry(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith({ error: 'Error: DB failure' });
  });
});
