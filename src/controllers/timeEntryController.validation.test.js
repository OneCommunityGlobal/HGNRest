const mongoose = require('mongoose');

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
jest.mock('../utilities/nodeCache', () =>
  jest.fn(() => ({
    getCache: jest.fn(),
    setCache: jest.fn(),
    hasCache: jest.fn(),
    removeCache: jest.fn(),
    clearByPrefix: jest.fn(),
  })),
);

const UserProfile = require('../models/userProfile');
const Project = require('../models/project');
const { hasPermission } = require('../utilities/permissions');
const timeEntryController = require('./timeEntryController');

const oid = () => new mongoose.Types.ObjectId().toString();

// Mimics Node's behaviour of throwing when a response is sent twice.
const makeStrictRes = () => {
  const res = { statusCodes: [], bodies: [], sent: false };
  res.status = jest.fn((code) => {
    res.statusCodes.push(code);
    return res;
  });
  res.send = jest.fn((body) => {
    if (res.sent) {
      const err = new Error('Cannot set headers after they are sent to the client');
      err.code = 'ERR_HTTP_HEADERS_SENT';
      throw err;
    }
    res.sent = true;
    res.bodies.push(body);
    return res;
  });
  return res;
};

describe('timeEntryController.postTimeEntry validation failures', () => {
  let session;
  let saveMock;
  let TimeEntry;
  let controller;
  let startSessionSpy;

  beforeEach(() => {
    jest.clearAllMocks();

    session = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    };
    startSessionSpy = jest.spyOn(mongoose, 'startSession').mockResolvedValue(session);

    saveMock = jest.fn().mockResolvedValue({});
    TimeEntry = function FakeTimeEntry() {};
    TimeEntry.prototype.save = saveMock;
    TimeEntry.findOne = jest.fn().mockResolvedValue({});
    TimeEntry.findById = jest.fn();
    TimeEntry.find = jest.fn();

    hasPermission.mockResolvedValue(true);
    UserProfile.findById.mockResolvedValue({
      _id: oid(),
      isActive: true,
      hoursByCategory: { unassigned: 0 },
      totalTangibleHrs: 0,
      totalIntangibleHrs: 0,
      save: jest.fn().mockResolvedValue(true),
    });
    Project.findById.mockResolvedValue({ category: 'General' });

    controller = timeEntryController(TimeEntry);
  });

  afterEach(() => {
    startSessionSpy.mockRestore();
  });

  const validBody = () => {
    const personId = oid();
    return {
      requestor: { requestorId: personId, roles: [] },
      personId,
      projectId: oid(),
      wbsId: null,
      taskId: null,
      teamId: null,
      dateOfWork: '2025-01-02',
      hours: 1,
      minutes: 0,
      notes: 'validation fallthrough regression',
      isTangible: false,
    };
  };

  const cases = [
    ['default', { entryType: 'default', dateOfWork: 'invalid-date' }],
    ['default (undefined entryType)', { entryType: undefined, dateOfWork: 'invalid-date' }],
    ['default (invalid projectId)', { entryType: 'default', projectId: 'not-an-object-id' }],
    ['person', { entryType: 'person', dateOfWork: 'invalid-date' }],
    ['project', { entryType: 'project', personId: undefined, hours: 0, minutes: 0 }],
    ['team', { entryType: 'team', personId: undefined, teamId: oid(), dateOfWork: 'invalid-date' }],
  ];

  test.each(cases)(
    '%s: returns 400 and performs no database write for invalid input',
    async (_label, overrides) => {
      const req = { body: { ...validBody(), ...overrides } };
      const res = makeStrictRes();

      let thrown;
      try {
        await controller.postTimeEntry(req, res);
      } catch (err) {
        thrown = err;
      }

      expect(res.statusCodes[0]).toBe(400);
      expect(res.bodies[0]).toEqual({ error: 'Bad request' });
      expect(saveMock).not.toHaveBeenCalled();
      expect(session.commitTransaction).not.toHaveBeenCalled();
      expect(startSessionSpy).not.toHaveBeenCalled();
      expect(thrown).toBeUndefined();
    },
  );
});
