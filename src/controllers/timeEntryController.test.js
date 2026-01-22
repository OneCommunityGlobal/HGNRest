const mongoose = require('mongoose');

const { mockRes, assertResMock } = require('../test');

const oid = () => new mongoose.Types.ObjectId().toString();

jest.mock('../startup/logger', () => ({
  logException: jest.fn(),
}));

jest.mock('../models/userProfile', () => ({
  findById: jest.fn(),
  find: jest.fn(),
  findOneAndUpdate: jest.fn(),
  findByIdAndUpdate: jest.fn(),
}));
jest.mock('../models/project', () => ({
  findById: jest.fn(),
}));
jest.mock('../models/task', () => ({
  findById: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));
jest.mock('../models/wbs', () => ({
  findById: jest.fn(),
}));
jest.mock('../utilities/emailSender', () => jest.fn());
jest.mock('../utilities/permissions', () => ({
  hasPermission: jest.fn(),
}));

const cacheMock = {
  getCache: jest.fn(),
  setCache: jest.fn(),
  hasCache: jest.fn(),
  removeCache: jest.fn(),
};
jest.mock('../utilities/nodeCache', () => jest.fn(() => cacheMock));

const logger = require('../startup/logger');
const UserProfile = require('../models/userProfile');
const Project = require('../models/project');
const Task = require('../models/task');
const emailSender = require('../utilities/emailSender');
const { hasPermission } = require('../utilities/permissions');
const timeEntryController = require('./timeEntryController');

const flush = () => new Promise(setImmediate);

const makeSession = () => {
  const session = {
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    abortTransaction: jest.fn(),
    endSession: jest.fn(),
  };
  return session;
};

const makeTimeEntryCtor = (saveMock) => {
  function FakeTimeEntry() {}
  FakeTimeEntry.prototype.save = saveMock;
  return FakeTimeEntry;
};

describe('Unit Tests: timeEntryController', () => {
  let TimeEntry;
  let controller;

  beforeEach(() => {
    jest.clearAllMocks();

    TimeEntry = {
      findOne: jest.fn(),
      findById: jest.fn(),
      find: jest.fn(),
      findOneAndUpdate: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      aggregate: jest.fn(),
    };

    const session = makeSession();
    jest.spyOn(mongoose, 'startSession').mockResolvedValue(session);

    controller = timeEntryController(TimeEntry);
  });

  describe('postTimeEntry()', () => {
    const baseReq = () => {
      const id = oid();
      return {
        body: {
          requestor: { requestorId: id, roles: [] },
          personId: id,
          projectId: new mongoose.Types.ObjectId().toString(),
          wbsId: null,
          taskId: null,
          teamId: null,
          dateOfWork: '2025-01-02',
          hours: 2,
          minutes: 15,
          notes: 'n',
          isTangible: true,
          entryType: 'default',
        },
      };
    };

    test('rejects when posting for others without permission', async () => {
      const req = baseReq();
      req.body.personId = 'someone-else';
      hasPermission.mockResolvedValue(false);

      const res = mockRes;
      const out = await controller.postTimeEntry(req, res);
      await flush();

      assertResMock(
        403,
        { error: 'You do not have permission to post time entries for others' },
        out,
        res,
      );
    });

    test('rejects on invalid payload (missing time and invalid date)', async () => {
      const req = baseReq();
      req.body.dateOfWork = 'invalid-date';
      req.body.hours = 0;
      req.body.minutes = 0;
      hasPermission.mockResolvedValue(true);

      const res = mockRes;
      const out = await controller.postTimeEntry(req, res);
      await flush();

      assertResMock(400, { error: 'Bad request' }, out, res);
    });

    test('tangible flow: updates profile category + task hours, commits', async () => {
      hasPermission.mockResolvedValue(true);

      const saved = { _id: 'te1' };
      const saveMock = jest.fn().mockResolvedValue(saved);
      controller = timeEntryController(Object.assign(makeTimeEntryCtor(saveMock), TimeEntry));

      const self = oid();
      const userprofileDoc = {
        _id: self,
        hoursByCategory: { unassigned: 0 },
        totalTangibleHrs: 0,
        totalIntangibleHrs: 0,
        save: jest.fn().mockResolvedValue(true),
      };
      UserProfile.findById.mockResolvedValue(userprofileDoc);
      Task.findOneAndUpdate.mockResolvedValue({
        hoursLogged: 10,
        estimatedHours: 5,
        taskName: 'T',
      });
      Project.findById.mockResolvedValue({ category: 'General' });
      emailSender.mockImplementation(() => {});

      const res = mockRes;
      const req = {
        body: {
          requestor: { requestorId: self },
          personId: self,
          projectId: new mongoose.Types.ObjectId().toString(),
          wbsId: null,
          taskId: new mongoose.Types.ObjectId().toString(),
          teamId: null,
          dateOfWork: '2025-01-02',
          hours: 2,
          minutes: 0,
          notes: 'a',
          isTangible: true,
          entryType: 'default',
        },
      };

      TimeEntry.findOne = jest.fn().mockResolvedValue(null);

      const out = await controller.postTimeEntry(req, res);
      await flush();

      expect(res.status).toHaveBeenCalledWith(200);
      expect(userprofileDoc.save).toHaveBeenCalled();
      expect(Task.findOneAndUpdate).toHaveBeenCalled();
      expect(emailSender).toHaveBeenCalled();
      expect(out).toBeUndefined();
    });

    test('intangible flow: updates only profile and commits', async () => {
      hasPermission.mockResolvedValue(true);

      const userprofileDoc = {
        _id: 'u1',
        hoursByCategory: { unassigned: 0 },
        totalTangibleHrs: 3,
        totalIntangibleHrs: 1,
        save: jest.fn().mockResolvedValue(true),
      };
      UserProfile.findById.mockResolvedValue(userprofileDoc);
      Task.findOneAndUpdate.mockResolvedValue({});

      const saveMock = jest.fn().mockResolvedValue({});
      controller = timeEntryController(Object.assign(makeTimeEntryCtor(saveMock), TimeEntry));

      const req = {
        body: {
          requestor: { requestorId: 'u1' },
          personId: 'u1',
          projectId: new mongoose.Types.ObjectId().toString(),
          dateOfWork: '2025-01-02',
          hours: 0,
          minutes: 30,
          notes: 'b',
          isTangible: false,
          entryType: 'default',
        },
      };
      TimeEntry.findOne = jest.fn().mockResolvedValue({});

      const res = mockRes;
      const out = await controller.postTimeEntry(req, res);
      await flush();

      expect(res.status).toHaveBeenCalledWith(200);
      expect(Task.findOneAndUpdate).not.toHaveBeenCalled();
      expect(userprofileDoc.save).toHaveBeenCalled();
      expect(out).toBeUndefined();
    });

    test('first-time entry flips flags', async () => {
      hasPermission.mockResolvedValue(true);

      const self = oid();
      const userprofileDoc = {
        _id: self,
        hoursByCategory: { unassigned: 0 },
        totalTangibleHrs: 0,
        totalIntangibleHrs: 0,
        isFirstTimelog: true,
        save: jest.fn().mockResolvedValue(true),
      };
      UserProfile.findById.mockResolvedValue(userprofileDoc);

      const saveMock = jest.fn().mockResolvedValue({});
      controller = timeEntryController(Object.assign(makeTimeEntryCtor(saveMock), TimeEntry));

      TimeEntry.findOne = jest.fn().mockResolvedValue(null);

      const res = mockRes;
      const req = {
        body: {
          requestor: { requestorId: self },
          personId: self,
          projectId: new mongoose.Types.ObjectId().toString(),
          dateOfWork: '2025-01-02',
          hours: 1,
          minutes: 0,
          notes: 'x',
          isTangible: true,
          entryType: 'default',
        },
      };
      await controller.postTimeEntry(req, res);
      await flush();

      expect(userprofileDoc.isFirstTimelog).toBe(false);
      expect(userprofileDoc.startDate).toBeDefined();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('server error aborts transaction and returns 500', async () => {
      hasPermission.mockResolvedValue(true);
      UserProfile.findById.mockRejectedValue(new Error('db boom'));

      const res = mockRes;
      const req = {
        body: {
          requestor: { requestorId: 'u1' },
          personId: 'u1',
          projectId: new mongoose.Types.ObjectId().toString(),
          dateOfWork: '2025-01-02',
          hours: 1,
          minutes: 0,
          notes: 'x',
          isTangible: true,
          entryType: 'default',
        },
      };
      await controller.postTimeEntry(req, res);
      await flush();

      expect(logger.logException).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('editTimeEntry()', () => {
    const baseReq = () => ({
      params: { timeEntryId: new mongoose.Types.ObjectId().toString() },
      body: {
        requestor: { requestorId: 'u1', roles: [] },
        personId: 'u1',
        hours: 1,
        minutes: 0,
        notes: 'n2',
        isTangible: true,
        projectId: new mongoose.Types.ObjectId().toString(),
        wbsId: null,
        taskId: null,
        dateOfWork: require('moment')().tz('America/Los_Angeles').format('YYYY-MM-DD'),
        entryType: 'default',
      },
    });

    test('400 when id invalid / projectId invalid in general/project entry', async () => {
      const req = baseReq();
      req.params.timeEntryId = 'bad';
      const res = mockRes;
      const out = await controller.editTimeEntry(req, res);
      await flush();
      assertResMock(400, { error: 'ObjectIds are not correctly formed' }, out, res);
    });

    test('403 when editing time without permission (not same-day self)', async () => {
      const self = oid();
      const req = {
        params: { timeEntryId: new mongoose.Types.ObjectId().toString() },
        body: {
          requestor: { requestorId: self, roles: [] },
          personId: self,
          hours: 2,
          minutes: 0,
          notes: 'n2',
          isTangible: true,
          projectId: new mongoose.Types.ObjectId().toString(),
          wbsId: null,
          taskId: null,
          dateOfWork: '2020-01-01',
          entryType: 'default',
        },
      };

      TimeEntry.findById = jest.fn().mockResolvedValue({
        totalSeconds: 3600,
        isTangible: true,
        projectId: mongoose.Types.ObjectId(req.body.projectId),
        taskId: null,
        dateOfWork: req.body.dateOfWork,
        notes: 'old',
        save: jest.fn().mockResolvedValue({}),
      });

      hasPermission
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      const res = mockRes;
      await controller.editTimeEntry(req, res);
      await flush();

      assertResMock(
        403,
        { error: 'You do not have permission to edit the time entry time' },
        undefined,
        res,
      );
    });

    test('403 when editing description without permission (not same-day self)', async () => {
      const req = baseReq();
      req.body.dateOfWork = '2024-01-01';
      req.body.notes = 'changed';

      TimeEntry.findById = jest.fn().mockResolvedValue({
        totalSeconds: 3600,
        isTangible: true,
        projectId: mongoose.Types.ObjectId(req.body.projectId),
        taskId: null,
        dateOfWork: req.body.dateOfWork,
        notes: 'old',
        save: jest.fn().mockResolvedValue({}),
      });

      hasPermission
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      const res = mockRes;
      await controller.editTimeEntry(req, res);
      await flush();

      assertResMock(
        403,
        { error: 'You do not have permission to edit the time entry description' },
        undefined,
        res,
      );
    });

    test('tangible→intangible updates tasks/categories/profile, commits', async () => {
      const req = baseReq();
      req.body.isTangible = false;
      TimeEntry.findById = jest.fn().mockResolvedValue({
        totalSeconds: 7200,
        isTangible: true,
        projectId: mongoose.Types.ObjectId(req.body.projectId),
        taskId: mongoose.Types.ObjectId(),
        dateOfWork: req.body.dateOfWork,
        notes: 'old',
        save: jest.fn().mockResolvedValue({}),
      });
      hasPermission.mockResolvedValue(true);

      const profile = {
        _id: 'u1',
        hoursByCategory: { unassigned: 0 },
        totalTangibleHrs: 10,
        totalIntangibleHrs: 5,
        timeEntryEditHistory: [],
        infringements: [],
        save: jest.fn().mockResolvedValue({}),
      };
      UserProfile.findById.mockResolvedValue(profile);
      Task.findOneAndUpdate.mockResolvedValue({});
      Project.findById.mockResolvedValue({ category: 'Housing' });

      const res = mockRes;
      await controller.editTimeEntry(req, res);
      await flush();

      expect(res.status).toHaveBeenCalledWith(200);
      expect(profile.save).toHaveBeenCalled();
    });

    test('tangible same-task time change updates and emails; adds edit history when needed', async () => {
      const req = baseReq();
      req.body.hours = 2;
      req.body.minutes = 0;

      const initial = {
        totalSeconds: 3600,
        isTangible: true,
        projectId: mongoose.Types.ObjectId(req.body.projectId),
        taskId: mongoose.Types.ObjectId(),
        dateOfWork: req.body.dateOfWork,
        notes: 'old',
        save: jest.fn().mockResolvedValue({}),
      };
      TimeEntry.findById.mockResolvedValue(initial);

      hasPermission
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      const profile = {
        _id: 'u1',
        hoursByCategory: { unassigned: 0 },
        totalTangibleHrs: 2,
        totalIntangibleHrs: 0,
        timeEntryEditHistory: [],
        infringements: [],
        save: jest.fn().mockResolvedValue({}),
        startDate: new Date().toISOString(),
        role: 'Volunteer',
        email: 'u@x',
        firstName: 'A',
        lastName: 'B',
      };
      UserProfile.findById.mockResolvedValue(profile);
      Task.findOneAndUpdate.mockResolvedValue({ hoursLogged: 3, estimatedHours: 2, taskName: 'T' });
      Project.findById.mockResolvedValue({ category: 'Food' });
      emailSender.mockImplementation(() => {});

      const res = mockRes;
      await controller.editTimeEntry(req, res);
      await flush();

      expect(res.status).toHaveBeenCalledWith(200);
      expect(emailSender).toHaveBeenCalled();
    });

    test('catches error and returns 400', async () => {
      const req = baseReq();
      TimeEntry.findById.mockRejectedValue(new Error('lookup fail'));
      const res = mockRes;
      await controller.editTimeEntry(req, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('deleteTimeEntry()', () => {
    test('400 when no id provided', async () => {
      const req = { params: {}, body: { requestor: { requestorId: 'u1' } } };
      const res = mockRes;
      const out = await controller.deleteTimeEntry(req, res);
      await flush();
      assertResMock(400, { error: 'Bad request' }, out, res);
    });

    test('403 when not same-day self and no permission', async () => {
      const req = {
        params: { timeEntryId: 'te1' },
        body: { requestor: { requestorId: 'u1' } },
      };
      TimeEntry.findById.mockResolvedValue({
        personId: new mongoose.Types.ObjectId('64b3f8c9a8f4e6b9c0a1b2c3'),
        totalSeconds: 3600,
        dateOfWork: '2020-01-01',
        isTangible: true,
        projectId: new mongoose.Types.ObjectId(),
        taskId: null,
      });
      hasPermission.mockResolvedValue(false);

      const res = mockRes;
      await controller.deleteTimeEntry(req, res);
      await flush();

      assertResMock(403, { error: 'Unauthorized request' }, undefined, res);
    });

    test('tangible delete adjusts task/profile and commits', async () => {
      const req = {
        params: { timeEntryId: 'te1' },
        body: { requestor: { requestorId: 'u1' } },
      };
      const today = require('moment')().tz('America/Los_Angeles').format('YYYY-MM-DD');
      const profile = {
        _id: 'u1',
        hoursByCategory: { unassigned: 0 },
        totalTangibleHrs: 5,
        totalIntangibleHrs: 1,
        save: jest.fn().mockResolvedValue(true),
      };
      TimeEntry.findById.mockResolvedValue({
        personId: new mongoose.Types.ObjectId('000000000000000000000001'),
        totalSeconds: 1800,
        dateOfWork: today,
        isTangible: true,
        projectId: new mongoose.Types.ObjectId(),
        taskId: new mongoose.Types.ObjectId(),
        remove: jest.fn().mockResolvedValue(true),
      });
      hasPermission.mockResolvedValue(true);
      UserProfile.findById.mockResolvedValue(profile);

      const res = mockRes;
      await controller.deleteTimeEntry(req, res);
      await flush();

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({ message: 'Successfully deleted' });
    });

    test('intangible delete adjusts profile only and commits', async () => {
      const req = {
        params: { timeEntryId: 'te1' },
        body: { requestor: { requestorId: 'u1' } },
      };
      const today = require('moment')().tz('America/Los_Angeles').format('YYYY-MM-DD');
      const profile = {
        _id: 'u1',
        hoursByCategory: { unassigned: 0 },
        totalTangibleHrs: 5,
        totalIntangibleHrs: 1,
        save: jest.fn().mockResolvedValue(true),
      };
      TimeEntry.findById.mockResolvedValue({
        personId: new mongoose.Types.ObjectId('000000000000000000000001'),
        totalSeconds: 600,
        dateOfWork: today,
        isTangible: false,
        projectId: null,
        taskId: null,
        remove: jest.fn().mockResolvedValue(true),
      });
      hasPermission.mockResolvedValue(true);
      UserProfile.findById.mockResolvedValue(profile);

      const res = mockRes;
      await controller.deleteTimeEntry(req, res);
      await flush();

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getTimeEntriesForSpecifiedPeriod()', () => {
    test('400 on invalid params', async () => {
      const req = { params: { fromdate: 'x', todate: 'y', userId: 'u' } };
      const res = mockRes;
      await controller.getTimeEntriesForSpecifiedPeriod(req, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('200 with enrichment and hours/minutes mapping', async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      const req = { params: { fromdate: '2025-01-01', todate: '2025-01-31', userId } };
      const te = {
        toObject: () => ({
          totalSeconds: 3900,
          taskId: new mongoose.Types.ObjectId(),
          projectId: new mongoose.Types.ObjectId(),
        }),
      };
      TimeEntry.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([te]) });
      Task.findById.mockResolvedValue({ taskName: 'Task A' });
      Project.findById.mockResolvedValue({ projectName: 'Proj A' });

      const res = mockRes;
      await controller.getTimeEntriesForSpecifiedPeriod(req, res);
      await flush();

      expect(res.status).toHaveBeenCalledWith(200);
      const data = res.send.mock.calls[0][0];
      expect(data[0].hours).toBe(1);
      expect(data[0].minutes).toBe(5);
      expect(data[0].taskName).toBe('Task A');
      expect(data[0].projectName).toBe('Proj A');
    });
  });

  describe('getUsersTotalHoursForSpecifiedPeriod()', () => {
    test('validates input', async () => {
      const req = { body: { userIds: null, fromDate: 'x', toDate: 'y' } };
      const res = mockRes;
      await controller.getUsersTotalHoursForSpecifiedPeriod(req, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('returns rounded totals; logs on error', async () => {
      const ids = [new mongoose.Types.ObjectId().toString()];
      const req = { body: { userIds: ids, fromDate: '2025-01-01', toDate: '2025-01-31' } };
      TimeEntry.aggregate.mockResolvedValue([{ _id: ids[0], totalHours: 3.3333 }]);

      const res = mockRes;
      await controller.getUsersTotalHoursForSpecifiedPeriod(req, res);
      await flush();

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith([{ userId: ids[0], totalHours: 3.3 }]);
    });
  });

  describe('project & people reports', () => {
    test('getTimeEntriesForProjectReports maps lean docs', async () => {
      const req = { body: { users: ['u'], fromDate: '2025-01-01', toDate: '2025-01-31' } };
      const results = [
        {
          isTangible: true,
          dateOfWork: '2025-01-02',
          totalSeconds: 3660,
          projectId: { _id: 'p', projectName: 'P' },
        },
      ];

      TimeEntry.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(results),
      });

      const res = mockRes;
      await controller.getTimeEntriesForProjectReports(req, res);
      await flush();

      expect(res.status).toHaveBeenCalledWith(200);
      const row = res.send.mock.calls[0][0][0];
      expect(row.hours).toBe('1');
      expect(row.minutes).toBe('1');
      expect(row.projectName).toBe('P');
    });

    test('getTimeEntriesForPeopleReports maps entries', async () => {
      const req = { body: { users: ['u'], fromDate: '2025-01-01', toDate: '2025-01-31' } };
      TimeEntry.find.mockReturnValue({
        lean: jest
          .fn()
          .mockResolvedValue([
            { personId: 'u', totalSeconds: 3900, isTangible: false, dateOfWork: '2025-01-10' },
          ]),
      });

      const res = mockRes;
      await controller.getTimeEntriesForPeopleReports(req, res);
      await flush();

      expect(res.status).toHaveBeenCalledWith(200);
      const row = res.send.mock.calls[0][0][0];
      expect(row.hours).toBe('1');
      expect(row.minutes).toBe('5');
      expect(row.isTangible).toBe(false);
    });
  });

  describe('getTimeEntriesForReports()', () => {
    test('returns from cache when present', async () => {
      cacheMock.getCache.mockReturnValue([{ cached: true }]);
      cacheMock.hasCache.mockReturnValue(true);

      const req = { body: { users: ['u'], fromDate: '2025-01-01', toDate: '2025-01-31' } };
      const res = mockRes;
      await controller.getTimeEntriesForReports(req, res);
      await flush();

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith([{ cached: true }]);
    });

    test('sets cache when miss', async () => {
      cacheMock.hasCache.mockReturnValue(false);
      TimeEntry.find.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          {
            _id: 'x',
            personId: 'u',
            isTangible: true,
            totalSeconds: 120,
            dateOfWork: '2025-01-02',
            projectId: { _id: 'p', projectName: 'P' },
          },
        ]),
      });

      const req = { body: { users: ['u'], fromDate: '2025-01-01', toDate: '2025-01-31' } };
      const res = mockRes;
      await controller.getTimeEntriesForReports(req, res);
      await flush();

      expect(cacheMock.setCache).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('startRecalculation() / checkRecalculationStatus()', () => {
    test('startRecalculation enqueues and returns task id', async () => {
      const res = mockRes;
      await controller.startRecalculation({}, res);
      await flush();

      expect(res.status).toHaveBeenCalledWith(200);
      const payload = res.send.mock.calls[0][0];
      expect(payload.message).toMatch(/started/i);
      expect(payload.taskId).toBeTruthy();
    });

    test('checkRecalculationStatus returns 404 when not found', async () => {
      const res = mockRes;
      await controller.checkRecalculationStatus({ params: { taskId: 'missing' } }, res);
      await flush();
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
