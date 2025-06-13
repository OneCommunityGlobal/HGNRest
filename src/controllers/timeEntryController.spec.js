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
  }))
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
      const req = { body: { users: ['user1', 'user2'], fromDate: '2025-01-01', toDate: '2025-01-31' } };
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
            totalSeconds: 7200
          }
        ]),
        then: function (resolve, reject) {
          return this.exec().then(resolve, reject);
        }
      });

      await controller.getTimeEntriesForUsersList(req, res);
      expect(findSpy).toHaveBeenCalledWith(expect.objectContaining({
        personId: { $in: ['user1', 'user2'] },
        dateOfWork: { $gte: '2025-01-01', $lte: '2025-01-31' },
        entryType: { $in: ['default', null, 'person'] }
      }), '-createdDateTime')

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(expect.any(Array));
    })
    it('should handle errors when fetching time entries', async () => {
      const req = { body: { users: ['user1', 'user2'], fromDate: '2025-01-01', toDate: '2025-01-31' } };
      const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
      const errorMsg = 'Database error';
      jest.spyOn(TimeEntry, 'find').mockImplementationOnce(() => {
        return {
          populate: jest.fn().mockReturnThis(),
          sort: jest.fn().mockReturnThis(),
          lean: jest.fn().mockReturnThis(),
          exec: jest.fn().mockRejectedValue(new Error(errorMsg)),
          then: function (resolve, reject) {
            return this.exec()
          }
        };
      });

      await expect(controller.getTimeEntriesForUsersList(req, res))
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
      expect(res.send).toHaveBeenCalledWith(expect.objectContaining({ message: 'The recalculation task started in the background' }));
    });
  });

  describe('postTimeEntry', () => {
    beforeEach(() => {
    UserProfile.findById = jest.fn().mockResolvedValue({ _id: 'user1', name: 'Test User',hoursByCategory: { 'category': 0 } });
    UserProfile.save = jest.fn();
    Project.findById = jest.fn().mockResolvedValue({ category: 'Category' });

    });
    afterEach(() => {
      jest.clearAllMocks();
    });
    it('should create a time entry successfully when posting for self', async () => {
      mockHasPermission(true);

      const req = {
        body: {
          personId: 'user1',
          projectId: 'proj1',
          hours: 2,
          minutes: 30,
          dateOfWork: '2025-01-01',
          entryType: 'person',
          requestor: { requestorId: 'user1' },
          isTangible:true
        }
      };
      const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };

      await controller.postTimeEntry(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(expect.objectContaining({ message: 'Time Entry saved successfully' }));
    });

    it('should return 403 if posting for another user without permission', async () => {
      mockHasPermission(false);

      const req = {
        body: {
          personId: 'user2',
          projectId: 'proj1',
          hours: 1,
          minutes: 45,
          dateOfWork: '2025-01-01',
          entryType: 'person',
          requestor: { requestorId: 'user1' }
        }
      };
      const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };

      await controller.postTimeEntry(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.send).toHaveBeenCalledWith({ error: 'You do not have permission to post time entries for others' });
    });

    it('should return 400 if request is invalid (missing dateOfWork)', async () => {
      mockHasPermission(true);

      const req = {
        body: {
          personId: 'user1',
          projectId: 'proj1',
          hours: 2,
          minutes: 30,
          entryType: 'person',
          requestor: { requestorId: 'user1' }
        }
      };
      const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };

      await controller.postTimeEntry(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith({ error: 'Bad request' });
    });

    it('should return 500 if an unexpected error occurs', async () => {
      mockHasPermission(true);
      jest.spyOn(TimeEntry.prototype, 'save').mockRejectedValue(new Error('Database failure'));

      const req = {
        body: {
          personId: 'user1',
          projectId: 'proj1',
          hours: 2,
          minutes: 30,
          dateOfWork: '2025-01-01',
          entryType: 'person',
          requestor: { requestorId: 'user1' }
        }
      };
      const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };

      await controller.postTimeEntry(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith({ error: 'Error: Database failure' });
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
        }
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
        expect.objectContaining({ status: expect.any(String), startTime: expect.any(String) })
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
      const req = { params: { timeEntryId: 'nonexistent' }, body: { requestor: { requestorId: 'user1' } } };
      const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
      jest.spyOn(TimeEntry, 'findById').mockResolvedValue(null);
      await controller.editTimeEntry(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith({ error: 'No valid records found for nonexistent' });
    });
    
    // it('should edit time entry successfully', async () => {
    //   // Use valid ObjectId-like strings for all IDs.
    //   const fakeTimeEntry = {
    //     _id: '507f1f77bcf86cd799439011',
    //     totalSeconds: 3600, // initial totalSeconds is 3600 seconds (1 hour)
    //     isTangible: true,
    //     notes: 'Old note',
    //     projectId: '507f1f77bcf86cd799439012',
    //     taskId: '507f1f77bcf86cd799439015',
    //     dateOfWork: '2025-01-01',
    //     save: jest.fn().mockResolvedValue(),
    //   };
    //   jest.spyOn(TimeEntry, 'findById').mockResolvedValue(fakeTimeEntry);
    
    //   const fakeUserProfile = {
    //     _id: '507f1f77bcf86cd799439016',
    //     timeEntryEditHistory: [],
    //     isFirstTimelog: true,
    //     startDate: 'oldDate',
    //     hoursByCategory: { category: 0, unassigned: 0 },
    //     totalTangibleHrs: 0,
    //     totalIntangibleHrs: 0,
    //     save: jest.fn().mockResolvedValue(),
    //   };
    //   UserProfile.findById = jest.fn().mockResolvedValue(fakeUserProfile);
    //   jest.spyOn(helper, 'hasPermission').mockResolvedValue(true);
    //   // Stub Task.findOneAndUpdate to simulate a successful update.
    //   jest.spyOn(Task, 'findOneAndUpdate').mockImplementation(() =>
    //     Promise.resolve({ hoursLogged: 0, estimatedHours: 1 })
    //   );    
    //   // To avoid triggering updateUserprofileCategoryHrs, ensure that neither projectChanged nor timeChanged occurs.
    //   // Keep the new hours/minutes (and therefore totalSeconds) the same, and use the same projectId.
    //   const req = {
    //     params: { timeEntryId: '507f1f77bcf86cd799439011' },
    //     body: {
    //       personId: '507f1f77bcf86cd799439016',
    //       hours: 1, // 1 hour => 3600 seconds (same as initial)
    //       minutes: 0,
    //       notes: 'New note',
    //       isTangible: true,
    //       projectId: '507f1f77bcf86cd799439012', // same as initial
    //       wbsId: '507f1f77bcf86cd799439013',
    //       taskId: '507f1f77bcf86cd799439015', // same as initial
    //       dateOfWork: '2025-01-01', // unchanged
    //       entryType: 'default',
    //       requestor: { requestorId: '507f1f77bcf86cd799439016' },
    //     },
    //   };
    //   const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
    
    //   await controller.editTimeEntry(req, res);
    //   expect(fakeTimeEntry.notes).toBe('New note');
    //   // Total seconds remains 3600 because no time change occurred.
    //   expect(fakeTimeEntry.totalSeconds).toBe(3600);
    //   expect(res.status).toHaveBeenCalledWith(200);
    //   expect(res.send).toHaveBeenCalledWith(fakeTimeEntry);
    // });
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
      const req = { params: { timeEntryId: 'nonexistent' }, body: { requestor: { requestorId: 'user1' } } };
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
    const req = { params: { timeEntryId: 'entry1' }, body: { requestor: { requestorId: 'user1' } } };
    const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
    await controller.deleteTimeEntry(req, res);
    expect(fakeTimeEntry.remove).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith({ message: 'Successfully deleted' });
  });
  });

});