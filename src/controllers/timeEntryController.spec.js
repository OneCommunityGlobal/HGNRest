const mongoose = require('mongoose');
jest.mock('../utilities/permissions', () => ({
  hasPermission: jest.fn(),
}));
jest.mock('../models/project');

const helper = require('../utilities/permissions');
const Project = require('../models/project');
const Task = require('../models/task');
const WBS = require('../models/wbs');
const emailSender = require('../utilities/emailSender');
jest.mock('../utilities/nodeCache', () =>
  jest.fn(() => ({
    removeCache: jest.fn(),
    setCache: jest.fn(),
    getCache: jest.fn(),
  })),
);

jest.mock('../models/userProfile');
jest.mock('../models/project');
jest.mock('../models/task');
jest.mock('../models/wbs');
jest.mock('../utilities/emailSender');
jest.mock('../utilities/permissions');
jest.mock('../utilities/nodeCache');
const UserProfile = require('../models/userProfile');
const TimeEntry = jest.fn().mockImplementation(() => ({
  save: jest.fn(),
  remove: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));

// Static methods (mock them separately)
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
const timeEntryController = require('./timeEntryController');

beforeEach(() => {
  // jest.spyOn(mongoose.Types, 'ObjectId').mockImplementation(id => id);
  jest.spyOn(mongoose.Types.ObjectId, 'isValid').mockReturnValue(true);

  jest.spyOn(mongoose.Connection.prototype, 'startSession').mockImplementation(() => ({
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    abortTransaction: jest.fn(),
    endSession: jest.fn(),
  }));
});

describe('TimeEntryController', () => {
  let controller;
  let mockHasPermission;
  beforeAll(() => {
    mockHasPermission = (value) =>
      jest.spyOn(helper, 'hasPermission').mockImplementationOnce(() => Promise.resolve(value));
  });
  beforeEach(() => {
    controller = timeEntryController(TimeEntry);
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getTimeEntriesForUsersList', () => {
    it('should return time entries for specified users', async () => {
      const req = {
        body: { users: ['user1', 'user2'], fromDate: '2025-01-01', toDate: '2025-01-31' },
      };
      const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
      const findSpy = jest.spyOn(TimeEntry, 'find').mockReturnValue({
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
        then: function (resolve, reject) {
          return this.exec().then(resolve, reject);
        },
      });

      await controller.getTimeEntriesForUsersList(req, res);
      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          personId: { $in: ['user1', 'user2'] },
          dateOfWork: { $gte: '2025-01-01', $lte: '2025-01-31' },
          entryType: { $in: ['default', null, 'person'] },
        }),
        '-createdDateTime',
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(expect.any(Array));
    });
    it('should handle errors when fetching time entries', async () => {
      const req = {
        body: { users: ['user1', 'user2'], fromDate: '2025-01-01', toDate: '2025-01-31' },
      };
      const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
      const errorMsg = 'Database error';
      jest.spyOn(TimeEntry, 'find').mockImplementationOnce(() => {
        return {
          populate: jest.fn().mockReturnThis(),
          sort: jest.fn().mockReturnThis(),
          lean: jest.fn().mockReturnThis(),
          exec: jest.fn().mockRejectedValue(new Error(errorMsg)),
          then: function (resolve, reject) {
            return this.exec();
          },
        };
      });

      await expect(controller.getTimeEntriesForUsersList(req, res));
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith(expect.objectContaining({ message: errorMsg }));
    });
  });

  describe('getTimeEntriesForSpecifiedProject', () => {
    it('should return time entries for a specified project', async () => {
      const req = { params: { fromDate: '2025-01-01', toDate: '2025-01-31', projectId: 'proj1' } };
      const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };

      await controller.getTimeEntriesForSpecifiedProject(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(expect.any(Array));
    });
  });

  describe('startRecalculation', () => {
    it('should start recalculation and return a task ID', async () => {
      const req = {};
      const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };

      await controller.startRecalculation(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'The recalculation task started in the background' }),
      );
    });
  });

  describe('getTimeEntriesForSpecifiedPeriod', () => {
    it('should return 400 if request is invalid', async () => {
      const req = { params: { fromdate: 'invalid', todate: '2025-01-31', userId: 'user1' } };
      const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
      await controller.getTimeEntriesForSpecifiedPeriod(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith({ error: 'Invalid request' });
    });

    it('should return time entries for a specified period', async () => {
      const req = { params: { fromdate: '2025-01-01', todate: '2025-01-31', userId: 'user1' } };
      const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
      jest.spyOn(TimeEntry, 'find').mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          {
            toObject: () => ({
              _id: 'entry1',
              projectId: 'proj1',
              taskId: 'task1',
              totalSeconds: 7200,
              dateOfWork: '2025-01-01',
            }),
          },
        ]),
        then: function (resolve, reject) {
          return this.exec().then(resolve, reject);
        },
      });
      jest.spyOn(Task, 'findById').mockResolvedValue({ taskName: 'Test Task' });
      jest.spyOn(Project, 'findById').mockResolvedValue({ projectName: 'Test Project' });
      await controller.getTimeEntriesForSpecifiedPeriod(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(expect.any(Array));
    });
  });

  describe('checkRecalculationStatus', () => {
    it('should return status for an existing recalculation task', async () => {
      // Start a recalculation to create a task
      const reqStart = {};
      const resStart = { status: jest.fn().mockReturnThis(), send: jest.fn() };
      await controller.startRecalculation(reqStart, resStart);
      const startResponse = resStart.send.mock.calls[0][0];
      const taskId = startResponse.taskId;
      const req = { params: { taskId } };
      const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
      await controller.checkRecalculationStatus(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(
        expect.objectContaining({ status: expect.any(String), startTime: expect.any(String) }),
      );
    });

    it('should return 404 for a non-existent recalculation task', async () => {
      const req = { params: { taskId: 'nonexistent-task' } };
      const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
      await controller.checkRecalculationStatus(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith({ message: 'Task not found' });
    });
  });

  describe('editTimeEntry', () => {
    it('should return 400 if timeEntryId is missing', async () => {
      const req = { params: {}, body: {} };
      const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
      await controller.editTimeEntry(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith({
        error: 'ObjectId in request param is not in correct format',
      });
    });

    it('should return 400 if no time entry is found', async () => {
      const req = {
        params: { timeEntryId: 'nonexistent' },
        body: { requestor: { requestorId: 'user1' } },
      };
      const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
      jest.spyOn(TimeEntry, 'findById').mockResolvedValue(null);
      await controller.editTimeEntry(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith({ error: 'No valid records found for nonexistent' });
    });
  });

  describe('deleteTimeEntry', () => {
    // Ensure moment is available for this block
    const moment = require('moment-timezone');
    it('should return 400 if timeEntryId is missing', async () => {
      const req = { params: {}, body: { requestor: { requestorId: 'user1' } } };
      const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
      await controller.deleteTimeEntry(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith({ error: 'Bad request' });
    });

    it('should return 400 if time entry is not found', async () => {
      const req = {
        params: { timeEntryId: 'nonexistent' },
        body: { requestor: { requestorId: 'user1' } },
      };
      const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
      jest.spyOn(TimeEntry, 'findById').mockResolvedValue(null);
      await controller.deleteTimeEntry(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith({ message: 'No valid record found' });
    });

    it('should delete time entry successfully', async () => {
      const fakeTimeEntry = {
        _id: 'entry1',
        personId: 'user1',
        totalSeconds: 3600,
        dateOfWork: moment().tz('America/Los_Angeles').format('YYYY-MM-DD'),
        projectId: 'proj1',
        taskId: 'task1',
        isTangible: true,
        remove: jest.fn().mockResolvedValue(),
      };
      jest.spyOn(TimeEntry, 'findById').mockResolvedValue(fakeTimeEntry);
      // Force UserProfile.findById to return null so that the helper calls are skipped.
      UserProfile.findById = jest.fn().mockResolvedValue(null);
      jest.spyOn(helper, 'hasPermission').mockResolvedValue(true);
      const req = {
        params: { timeEntryId: 'entry1' },
        body: { requestor: { requestorId: 'user1' } },
      };
      const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
      await controller.deleteTimeEntry(req, res);
      expect(fakeTimeEntry.remove).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({ message: 'Successfully deleted' });
    });
  });
});
