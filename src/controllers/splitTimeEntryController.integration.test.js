jest.mock('../startup/logger', () => ({ logException: jest.fn(), logInfo: jest.fn() }));
jest.mock('../utilities/emailSender', () => jest.fn());
jest.mock('../utilities/permissions', () => ({ hasPermission: jest.fn().mockResolvedValue(true) }));
jest.mock('../utilities/nodeCache', () =>
  jest.fn(() => ({ removeCache: jest.fn(), clearByPrefix: jest.fn() })),
);

const mongoose = require('mongoose');
// NODE-7832: newer memory-server drivers need an explicit OS adapter under Jest.
// Keep the real driver and real database; only supply its documented runtime adapter.
// https://jira.mongodb.org/browse/NODE-7832
const memoryServerPath = require.resolve('mongodb-memory-server-core');
const driverPath = require.resolve('mongodb', { paths: [memoryServerPath] });
const driverPackagePath = require.resolve('mongodb/package.json', { paths: [memoryServerPath] });
if (Number.parseFloat(jest.requireActual(driverPackagePath).version) >= 7.6) {
  const driver = jest.requireActual(driverPath);
  class TestMongoClient extends driver.MongoClient {
    constructor(uri, options) {
      super(uri, { ...options, runtimeAdapters: { os: require('os') } });
    }

    static async connect(uri, options) {
      return new TestMongoClient(uri, options).connect();
    }
  }
  jest.doMock(driverPath, () => ({ ...driver, MongoClient: TestMongoClient }));
}
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const moment = require('moment-timezone');
const TimeEntry = require('../models/timeentry');
const UserProfile = require('../models/userProfile');
const Project = require('../models/project');
const Task = require('../models/task');
const WBS = require('../models/wbs');
const Timer = require('../models/timer');
const Batch = require('../models/timeEntryBatch');
const createController = require('./timeEntryController');

const uuid = 'a3a4b563-ffcc-4444-8888-8db03d973c63';
const notes =
  'Implemented and tested the assigned task with isolated fixtures and documented the result https://example.org/pr';
let replica;
let controller;
let user;
let project;
let tasks;
let timer;
let payload;
const invoke = async (body = payload, auth = String(user), method = 'postSplitTimeEntries') => {
  let status;
  let result;
  const res = {
    status(code) {
      status = code;
      return this;
    },
    send(value) {
      result = JSON.parse(JSON.stringify(value));
      return this;
    },
  };
  await controller[method](
    {
      user: { requestorId: auth },
      body: { ...JSON.parse(JSON.stringify(body)), requestor: { requestorId: auth } },
      params: { batchId: body.batchId, timeEntryId: String(body._id || '') },
    },
    res,
  );
  return { status, result };
};

beforeAll(async () => {
  replica = await MongoMemoryReplSet.create({
    binary: { version: process.env.MONGOMS_VERSION || '7.0.14' },
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  await mongoose.connect(replica.getUri(), { useNewUrlParser: true, useUnifiedTopology: true });
  await Promise.all(
    [TimeEntry, UserProfile, Project, Task, WBS, Timer, Batch].map((model) =>
      model.createCollection(),
    ),
  );
  controller = createController(TimeEntry);
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  if (replica) await replica.stop();
});

beforeEach(async () => {
  jest.restoreAllMocks();
  for (const model of [TimeEntry, UserProfile, Project, Task, WBS, Timer, Batch])
    await model.deleteMany({});
  user = new mongoose.Types.ObjectId();
  project = new mongoose.Types.ObjectId();
  const wbs = new mongoose.Types.ObjectId();
  tasks = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
  timer = new mongoose.Types.ObjectId();
  await UserProfile.collection.insertOne({
    _id: user,
    firstName: 'Local',
    lastName: 'Tester',
    email: 'local@example.invalid',
    password: 'fixture',
    isActive: true,
    projects: [project],
    totalTangibleHrs: 0,
    totalIntangibleHrs: 0,
    hoursByCategory: { housing: 0, food: 0, unassigned: 0 },
    isFirstTimelog: true,
  });
  await Project.collection.insertOne({
    _id: project,
    projectName: 'Isolated project',
    category: 'Housing',
    isActive: true,
  });
  await WBS.collection.insertOne({
    _id: wbs,
    wbsName: 'Local WBS',
    projectId: project,
    isActive: true,
  });
  await Task.collection.insertMany(
    tasks.map((id, index) => ({
      _id: id,
      taskName: `Task ${index + 1}`,
      wbsId: wbs,
      isActive: true,
      deleted: false,
      resources: [{ name: 'Local Tester', userID: user }],
      hoursLogged: 0,
      estimatedHours: 20,
    })),
  );
  await Timer.collection.insertOne({
    _id: timer,
    userId: user,
    goal: 18000000,
    time: 0,
    paused: true,
    started: true,
    loggingSessionId: uuid,
  });
  payload = {
    personId: String(user),
    batchId: uuid,
    dateOfWork: moment().tz('America/Los_Angeles').format('YYYY-MM-DD'),
    totalMinutes: 300,
    allocations: tasks.map((id, i) => ({ taskId: String(id), minutes: i ? 120 : 180, notes })),
  };
});

test('commits one entry per task and updates exact profile/category/task hours together', async () => {
  const response = await invoke();
  expect(response.status).toBe(200);
  expect(await TimeEntry.countDocuments()).toBe(2);
  expect(await Batch.countDocuments()).toBe(1);
  expect((await TimeEntry.find()).reduce((sum, e) => sum + e.totalSeconds, 0)).toBe(18000);
  const profile = await UserProfile.findById(user);
  expect(profile.totalTangibleHrs).toBe(5);
  expect(profile.hoursByCategory.housing).toBe(5);
  expect(profile.isFirstTimelog).toBe(false);
  expect((await Task.findById(tasks[0])).hoursLogged).toBe(3);
  expect((await Task.findById(tasks[1])).hoursLogged).toBe(2);
});

test('replays a lost response without adding entries or hours, including after timer stop', async () => {
  await invoke();
  await Timer.updateOne({ _id: timer }, { $set: { started: false } });
  const response = await invoke();
  expect(response.status).toBe(200);
  expect(response.result.replayed).toBe(true);
  expect(await TimeEntry.countDocuments()).toBe(2);
  expect((await UserProfile.findById(user)).totalTangibleHrs).toBe(5);
});

test('serializes simultaneous submissions for the same server timer session', async () => {
  const responses = await Promise.all([invoke(), invoke()]);
  expect(responses.map((r) => r.status)).toEqual([200, 200]);
  expect(await TimeEntry.countDocuments()).toBe(2);
  expect((await UserProfile.findById(user)).totalTangibleHrs).toBe(5);
});

test('rejects changed allocations for an already committed session and exposes the original receipt', async () => {
  await invoke();
  const response = await invoke({
    ...payload,
    allocations: payload.allocations.map((row) => ({ ...row, notes: `${notes} extra` })),
  });
  expect(response.status).toBe(409);
  const receipt = await invoke(payload, String(user), 'getSplitTimeEntryReceipt');
  expect(receipt.status).toBe(200);
  expect(receipt.result.allocations.map((row) => row.notes)).toEqual([notes, notes]);
  expect(await TimeEntry.countDocuments()).toBe(2);
});

test('rolls back earlier row writes when a later task is no longer assigned', async () => {
  await Task.updateOne({ _id: tasks[1] }, { $set: { resources: [] } });
  expect((await invoke()).status).toBe(403);
  expect(await TimeEntry.countDocuments()).toBe(0);
  expect(await Batch.countDocuments()).toBe(0);
  expect((await Task.findById(tasks[0])).hoursLogged).toBe(0);
  expect((await UserProfile.findById(user)).totalTangibleHrs).toBe(0);
});

test('rolls back all rows on a save failure and permits a clean retry', async () => {
  const save = jest
    .spyOn(Batch.prototype, 'save')
    .mockRejectedValueOnce(new Error('Isolated simulated failure'));
  expect((await invoke()).status).toBe(503);
  expect(await TimeEntry.countDocuments()).toBe(0);
  expect((await Task.findById(tasks[0])).hoursLogged).toBe(0);
  save.mockRestore();
  expect((await invoke()).status).toBe(200);
  expect(await TimeEntry.countDocuments()).toBe(2);
});

test.each(['inactiveTask', 'inactiveProject', 'inactiveWBS', 'unassignedProject', 'inactiveUser'])(
  'rejects %s without writing',
  async (condition) => {
    if (condition === 'inactiveTask')
      await Task.updateOne({ _id: tasks[0] }, { $set: { isActive: false } });
    if (condition === 'inactiveProject')
      await Project.updateOne({ _id: project }, { $set: { isActive: false } });
    if (condition === 'inactiveWBS') await WBS.updateMany({}, { $set: { isActive: false } });
    if (condition === 'unassignedProject')
      await UserProfile.updateOne({ _id: user }, { $set: { projects: [] } });
    if (condition === 'inactiveUser')
      await UserProfile.updateOne({ _id: user }, { $set: { isActive: false } });
    expect((await invoke()).status).toBe(403);
    expect(await TimeEntry.countDocuments()).toBe(0);
  },
);

test('uses authenticated identity, not a forged body requestor', async () => {
  const response = await invoke(
    { ...payload, requestor: { requestorId: String(user), role: 'Owner' } },
    String(new mongoose.Types.ObjectId()),
  );
  expect(response.status).toBe(403);
  expect(await Batch.countDocuments()).toBe(0);
});

test('rejects an inactive, replaced or over-allocated server timer', async () => {
  expect((await invoke({ ...payload, batchId: 'another-server-session' })).status).toBe(409);
  await Timer.updateOne({ _id: timer }, { $set: { time: 17940000 } });
  expect((await invoke()).status).toBe(400);
  expect(await TimeEntry.countDocuments()).toBe(0);
});

test('preserves fractional hours for separate one-minute allocations', async () => {
  const response = await invoke({
    ...payload,
    totalMinutes: 2,
    allocations: payload.allocations.map((row) => ({ ...row, minutes: 1 })),
  });
  expect(response.status).toBe(200);
  expect((await UserProfile.findById(user)).totalTangibleHrs).toBeCloseTo(2 / 60, 10);
  expect((await UserProfile.findById(user)).hoursByCategory.housing).toBeCloseTo(2 / 60, 10);
  expect((await Task.findById(tasks[0])).hoursLogged).toBeCloseTo(1 / 60, 10);
});

test('receipt lookup cannot expose another user’s saved split', async () => {
  await invoke();
  const response = await invoke(
    payload,
    String(new mongoose.Types.ObjectId()),
    'getSplitTimeEntryReceipt',
  );
  expect(response.status).toBe(404);
});

test('concurrent different allocations produce one saved split and one conflict', async () => {
  const changed = {
    ...payload,
    allocations: payload.allocations.map((row) => ({
      ...row,
      notes: `${notes} additional context`,
    })),
  };
  const responses = await Promise.all([invoke(), invoke(changed)]);
  expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
  expect(await TimeEntry.countDocuments()).toBe(2);
  expect(await Batch.countDocuments()).toBe(1);
  expect((await UserProfile.findById(user)).totalTangibleHrs).toBe(5);
});

test('sends notifications only after commit, never on rollback or replay', async () => {
  const notifications = [];
  const notifyTaskOvertimeEmailBody = jest.fn(async () => {
    notifications.push({
      batches: await Batch.countDocuments(),
      entries: await TimeEntry.countDocuments(),
    });
  });
  controller = require('./splitTimeEntryController')({
    TimeEntry,
    notifyTaskOvertimeEmailBody,
    removeOutdatedUserprofileCache: jest.fn(),
    invalidateWeeklySummariesCache: jest.fn(),
  });
  await Task.updateMany({}, { $set: { estimatedHours: 0 } });
  const save = jest
    .spyOn(Batch.prototype, 'save')
    .mockRejectedValueOnce(new Error('Receipt failure'));
  expect((await invoke()).status).toBe(503);
  expect(notifyTaskOvertimeEmailBody).not.toHaveBeenCalled();
  save.mockRestore();
  expect((await invoke()).status).toBe(200);
  expect(notifyTaskOvertimeEmailBody).toHaveBeenCalledTimes(2);
  expect(notifications).toEqual([
    { batches: 1, entries: 2 },
    { batches: 1, entries: 2 },
  ]);
  expect((await invoke()).status).toBe(200);
  expect(notifyTaskOvertimeEmailBody).toHaveBeenCalledTimes(2);
  controller = createController(TimeEntry);
});

test('editing and deleting a fractional split entry preserve the remaining exact hours', async () => {
  const initial = {
    ...payload,
    totalMinutes: 2,
    allocations: payload.allocations.map((row) => ({ ...row, minutes: 1 })),
  };
  const saved = await invoke(initial);
  expect(saved.status).toBe(200);
  const entry = await TimeEntry.findById(saved.result.entryIds[0]).lean();
  const edit = await invoke({ ...entry, hours: 0, minutes: 2 }, String(user), 'editTimeEntry');
  expect(edit.status).toBe(200);
  expect((await UserProfile.findById(user)).totalTangibleHrs).toBeCloseTo(3 / 60, 10);
  expect((await UserProfile.findById(user)).hoursByCategory.housing).toBeCloseTo(3 / 60, 10);
  const deleted = await invoke({ _id: entry._id }, String(user), 'deleteTimeEntry');
  expect(deleted.status).toBe(200);
  expect((await UserProfile.findById(user)).totalTangibleHrs).toBeCloseTo(1 / 60, 10);
  expect((await UserProfile.findById(user)).hoursByCategory.housing).toBeCloseTo(1 / 60, 10);
  expect((await Task.findById(tasks[0])).hoursLogged).toBeCloseTo(0, 10);
  expect((await invoke(initial)).status).toBe(200);
  expect(await TimeEntry.countDocuments()).toBe(1);
});
