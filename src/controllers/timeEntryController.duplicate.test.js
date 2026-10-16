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

const mongoose = require('mongoose');
const logger = require('../startup/logger');
const UserProfile = require('../models/userProfile');
const Project = require('../models/project');
const Task = require('../models/task');
const emailSender = require('../utilities/emailSender');
const { hasPermission } = require('../utilities/permissions');
const timeEntryController = require('./timeEntryController');

const oid = () => new mongoose.Types.ObjectId().toString();

const NOW = new Date('2026-03-10T12:00:00.000Z').getTime();
const DAY_MS = 24 * 60 * 60 * 1000;
const NOTES =
  'Reviewed the onboarding flow and documented the findings <p>https://example.com/doc</p>';

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

// Evaluates only the filter shape the duplicate lookup is allowed to use.
const makeExists = (entries) =>
  jest.fn(async (filter) => {
    const keys = Object.keys(filter).sort().join(',');
    if (keys !== 'createdDateTime,notes,personId') {
      throw new Error(`Unexpected duplicate lookup filter keys: ${keys}`);
    }
    return entries.some(
      (entry) =>
        String(entry.personId) === String(filter.personId) &&
        entry.notes === filter.notes &&
        entry.createdDateTime.getTime() >= filter.createdDateTime.$gte.getTime(),
    );
  });

describe('timeEntryController.postTimeEntry duplicate detection', () => {
  let session;
  let saved;
  let saveMock;
  let TimeEntry;
  let controller;
  let startSessionSpy;
  let userprofileDoc;
  let personId;

  const storedEntry = (overrides = {}) => ({
    personId,
    notes: NOTES,
    createdDateTime: new Date(NOW - DAY_MS),
    projectId: oid(),
    taskId: oid(),
    totalSeconds: 600,
    isTangible: true,
    entryType: 'default',
    ...overrides,
  });

  const buildBody = (overrides = {}) => ({
    requestor: { requestorId: personId, roles: [] },
    personId,
    projectId: oid(),
    wbsId: null,
    taskId: null,
    teamId: null,
    dateOfWork: '2025-01-02',
    hours: 1,
    minutes: 30,
    notes: NOTES,
    isTangible: false,
    entryType: 'default',
    ...overrides,
  });

  const post = async (body) => {
    const res = makeStrictRes();
    let thrown;
    try {
      await controller.postTimeEntry({ body }, res);
    } catch (err) {
      thrown = err;
    }
    return { res, thrown };
  };

  const expectNoPersistence = () => {
    expect(startSessionSpy).not.toHaveBeenCalled();
    expect(saveMock).not.toHaveBeenCalled();
    expect(session.commitTransaction).not.toHaveBeenCalled();
    expect(userprofileDoc.save).not.toHaveBeenCalled();
    expect(UserProfile.findById).not.toHaveBeenCalled();
    expect(TimeEntry.findOne).not.toHaveBeenCalled();
    expect(Task.findOneAndUpdate).not.toHaveBeenCalled();
    expect(Project.findById).not.toHaveBeenCalled();
    expect(emailSender).not.toHaveBeenCalled();
  };

  const DUPLICATE_BODY = { error: 'Duplicate time entry', code: 'DUPLICATE_TIME_ENTRY' };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(NOW);

    personId = oid();
    session = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    };
    startSessionSpy = jest.spyOn(mongoose, 'startSession').mockResolvedValue(session);

    saved = undefined;
    saveMock = jest.fn(function save() {
      saved = this;
      return Promise.resolve(this);
    });
    TimeEntry = function FakeTimeEntry() {};
    TimeEntry.prototype.save = saveMock;
    TimeEntry.exists = makeExists([]);
    TimeEntry.findOne = jest.fn().mockResolvedValue({});
    TimeEntry.findById = jest.fn();
    TimeEntry.find = jest.fn();

    userprofileDoc = {
      _id: personId,
      isActive: true,
      hoursByCategory: { unassigned: 0 },
      totalTangibleHrs: 0,
      totalIntangibleHrs: 0,
      save: jest.fn().mockResolvedValue(true),
    };
    UserProfile.findById.mockResolvedValue(userprofileDoc);
    Project.findById.mockResolvedValue({ category: 'General' });
    Task.findOneAndUpdate.mockResolvedValue({ hoursLogged: 1, estimatedHours: 5, taskName: 'T' });
    hasPermission.mockResolvedValue(true);

    controller = timeEntryController(TimeEntry);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('normal submissions', () => {
    test('saves normally and returns 200 when no matching entry exists', async () => {
      const { res, thrown } = await post(buildBody());

      expect(thrown).toBeUndefined();
      expect(res.statusCodes).toEqual([200]);
      expect(res.bodies[0]).toEqual({ message: 'Time Entry saved successfully' });
      expect(TimeEntry.exists).toHaveBeenCalledTimes(1);
      expect(saveMock).toHaveBeenCalledTimes(1);
      expect(session.commitTransaction).toHaveBeenCalledTimes(1);
    });

    test('looks up by target personId, exact notes and a rolling seven-day window', async () => {
      await post(buildBody());

      expect(TimeEntry.exists).toHaveBeenCalledWith({
        personId,
        notes: NOTES,
        createdDateTime: { $gte: new Date(NOW - 7 * DAY_MS) },
      });
    });

    test('saves when the matching notes are older than seven days', async () => {
      TimeEntry.exists = makeExists([
        storedEntry({ createdDateTime: new Date(NOW - 7 * DAY_MS - 1) }),
      ]);

      const { res } = await post(buildBody());

      expect(res.statusCodes).toEqual([200]);
      expect(saveMock).toHaveBeenCalledTimes(1);
    });

    test('saves when a different user used identical notes', async () => {
      TimeEntry.exists = makeExists([storedEntry({ personId: oid() })]);

      const { res } = await post(buildBody());

      expect(res.statusCodes).toEqual([200]);
      expect(saveMock).toHaveBeenCalledTimes(1);
    });

    test('saves when notes differ only by case or whitespace', async () => {
      TimeEntry.exists = makeExists([storedEntry({ notes: NOTES.toUpperCase() })]);

      const { res } = await post(buildBody({ notes: `${NOTES} ` }));

      expect(res.statusCodes).toEqual([200]);
    });
  });

  describe('duplicate without confirmation', () => {
    test('returns 409 for exact notes submitted within seven days', async () => {
      TimeEntry.exists = makeExists([storedEntry()]);

      const { res, thrown } = await post(buildBody());

      expect(thrown).toBeUndefined();
      expect(res.statusCodes).toEqual([409]);
      expect(res.bodies).toEqual([DUPLICATE_BODY]);
    });

    test('includes the exact seven-day boundary', async () => {
      TimeEntry.exists = makeExists([storedEntry({ createdDateTime: new Date(NOW - 7 * DAY_MS) })]);

      const { res } = await post(buildBody());

      expect(res.statusCodes).toEqual([409]);
    });

    test('ignores task, project and duration differences', async () => {
      TimeEntry.exists = makeExists([
        storedEntry({ taskId: oid(), projectId: oid(), totalSeconds: 60 }),
      ]);

      const { res } = await post(
        buildBody({ taskId: oid(), projectId: oid(), hours: 4, minutes: 5 }),
      );

      expect(res.statusCodes).toEqual([409]);
      expect(res.bodies).toEqual([DUPLICATE_BODY]);
    });

    test.each([
      ['tangible', true],
      ['intangible', false],
    ])('returns 409 for a %s duplicate', async (_label, isTangible) => {
      TimeEntry.exists = makeExists([storedEntry({ isTangible: !isTangible })]);

      const { res } = await post(buildBody({ isTangible }));

      expect(res.statusCodes).toEqual([409]);
    });

    test('checks requests with an undefined entryType', async () => {
      TimeEntry.exists = makeExists([storedEntry()]);

      const { res } = await post(buildBody({ entryType: undefined }));

      expect(res.statusCodes).toEqual([409]);
    });

    test('scopes the lookup to the target user, not the requestor', async () => {
      const requestorId = oid();
      TimeEntry.exists = makeExists([storedEntry()]);

      const { res } = await post(buildBody({ requestor: { requestorId, roles: [] } }));

      expect(res.statusCodes).toEqual([409]);
      expect(TimeEntry.exists.mock.calls[0][0].personId).toBe(personId);
    });

    test('causes no persistence side effects and exposes no entry details', async () => {
      TimeEntry.exists = makeExists([storedEntry()]);

      const { res } = await post(buildBody({ isTangible: true, taskId: oid() }));

      expect(res.bodies).toEqual([DUPLICATE_BODY]);
      expectNoPersistence();
      expect(JSON.stringify(res.bodies[0])).not.toContain(personId);
    });
  });

  describe('explicit confirmation', () => {
    test.each([
      ['tangible', true],
      ['intangible', false],
    ])('saves a %s duplicate when allowDuplicate is true', async (_label, isTangible) => {
      TimeEntry.exists = makeExists([storedEntry()]);

      const { res, thrown } = await post(buildBody({ isTangible, allowDuplicate: true }));

      expect(thrown).toBeUndefined();
      expect(res.statusCodes).toEqual([200]);
      expect(res.bodies[0]).toEqual({ message: 'Time Entry saved successfully' });
      expect(TimeEntry.exists).not.toHaveBeenCalled();
      expect(saveMock).toHaveBeenCalledTimes(1);
      expect(session.commitTransaction).toHaveBeenCalledTimes(1);
    });

    test('does not persist allowDuplicate', async () => {
      await post(buildBody({ allowDuplicate: true }));

      expect(saved).toBeDefined();
      expect(saved.allowDuplicate).toBeUndefined();
      expect(Object.keys(saved)).not.toContain('allowDuplicate');
    });

    test.each([
      ['missing', undefined],
      ['false', false],
      ['the string "true"', 'true'],
      ['the number 1', 1],
      ['null', null],
      ['an object', { value: true }],
      ['an array', [true]],
    ])('still returns 409 when allowDuplicate is %s', async (_label, flag) => {
      TimeEntry.exists = makeExists([storedEntry()]);

      const { res } = await post(buildBody({ allowDuplicate: flag }));

      expect(res.statusCodes).toEqual([409]);
      expect(res.bodies).toEqual([DUPLICATE_BODY]);
      expect(TimeEntry.exists).toHaveBeenCalledTimes(1);
      expectNoPersistence();
    });

    test('still enforces authorization when allowDuplicate is true', async () => {
      hasPermission.mockResolvedValue(false);

      const { res } = await post(buildBody({ personId: oid(), allowDuplicate: true }));

      expect(res.statusCodes).toEqual([403]);
      expectNoPersistence();
    });

    test('still enforces validation when allowDuplicate is true', async () => {
      const { res } = await post(buildBody({ dateOfWork: 'invalid-date', allowDuplicate: true }));

      expect(res.statusCodes).toEqual([400]);
      expectNoPersistence();
    });
  });

  describe('authorization and validation', () => {
    test('returns the existing 403 without lookup or writes', async () => {
      hasPermission.mockResolvedValue(false);
      TimeEntry.exists = makeExists([storedEntry()]);

      const { res } = await post(buildBody({ personId: oid() }));

      expect(res.statusCodes).toEqual([403]);
      expect(res.bodies).toEqual([
        { error: 'You do not have permission to post time entries for others' },
      ]);
      expect(TimeEntry.exists).not.toHaveBeenCalled();
      expectNoPersistence();
    });

    test('checks the target user when the requestor may post for others', async () => {
      const targetId = oid();
      TimeEntry.exists = makeExists([storedEntry({ personId: targetId })]);

      const { res } = await post(buildBody({ personId: targetId }));

      expect(res.statusCodes).toEqual([409]);
      expect(TimeEntry.exists.mock.calls[0][0].personId).toBe(targetId);
    });

    test.each([
      ['an invalid date', { dateOfWork: 'invalid-date' }],
      ['no time', { hours: 0, minutes: 0 }],
      ['an invalid projectId', { projectId: 'not-an-object-id' }],
      ['an invalid personId', { personId: 'not-an-object-id' }],
    ])('returns the existing 400 for %s without lookup or writes', async (_label, overrides) => {
      TimeEntry.exists = makeExists([storedEntry()]);
      const body = buildBody(overrides);
      if (overrides.personId) body.requestor.requestorId = overrides.personId;

      const { res, thrown } = await post(body);

      expect(thrown).toBeUndefined();
      expect(res.statusCodes).toEqual([400]);
      expect(res.bodies).toEqual([{ error: 'Bad request' }]);
      expect(TimeEntry.exists).not.toHaveBeenCalled();
      expectNoPersistence();
    });

    test('returns 500 without writes when the duplicate lookup fails', async () => {
      TimeEntry.exists = jest.fn().mockRejectedValue(new Error('lookup failed'));

      const { res, thrown } = await post(buildBody());

      expect(thrown).toBeUndefined();
      expect(res.statusCodes).toEqual([500]);
      expect(logger.logException).toHaveBeenCalled();
      expectNoPersistence();
    });

    test('skips the lookup when notes is not a string', async () => {
      const { res } = await post(buildBody({ notes: { $ne: null } }));

      expect(TimeEntry.exists).not.toHaveBeenCalled();
      expect(res.statusCodes).toEqual([200]);
    });
  });

  describe('non-default entry types', () => {
    const matching = () => makeExists([storedEntry()]);

    test('does not check person entries', async () => {
      TimeEntry.exists = matching();

      const { res } = await post(buildBody({ entryType: 'person' }));

      expect(TimeEntry.exists).not.toHaveBeenCalled();
      expect(res.statusCodes).toEqual([200]);
      expect(saveMock).toHaveBeenCalledTimes(1);
    });

    test('does not check project entries', async () => {
      TimeEntry.exists = matching();

      const { res } = await post(buildBody({ entryType: 'project', personId: undefined }));

      expect(TimeEntry.exists).not.toHaveBeenCalled();
      expect(res.statusCodes).toEqual([200]);
      expect(saveMock).toHaveBeenCalledTimes(1);
    });

    test('does not check team entries', async () => {
      TimeEntry.exists = matching();

      const { res } = await post(
        buildBody({ entryType: 'team', personId: undefined, teamId: oid() }),
      );

      expect(TimeEntry.exists).not.toHaveBeenCalled();
      expect(res.statusCodes).toEqual([200]);
      expect(saveMock).toHaveBeenCalledTimes(1);
    });
  });
});
