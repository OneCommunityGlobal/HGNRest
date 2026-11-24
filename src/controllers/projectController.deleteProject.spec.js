jest.mock('../utilities/permissions', () => ({ hasPermission: jest.fn() }));
jest.mock('../startup/logger', () => ({ logInfo: jest.fn(), logException: jest.fn() }));
jest.mock('../models/timeentry', () => ({ exists: jest.fn(), deleteMany: jest.fn() }));
jest.mock('../models/task', () => ({ find: jest.fn(), deleteMany: jest.fn() }));
jest.mock('../models/wbs', () => ({ find: jest.fn(), exists: jest.fn(), deleteMany: jest.fn() }));
jest.mock('../models/userProfile', () => ({ updateMany: jest.fn() }));
jest.mock('../models/followUp', () => ({ deleteMany: jest.fn() }));
jest.mock('../models/taskEditSuggestion', () => ({ deleteMany: jest.fn() }));
jest.mock('../models/inventoryItem', () => ({ exists: jest.fn() }));
jest.mock('../models/title', () => ({ find: jest.fn() }));

const mongoose = require('mongoose');
const { hasPermission } = require('../utilities/permissions');
const logger = require('../startup/logger');
const timeentry = require('../models/timeentry');
const task = require('../models/task');
const wbs = require('../models/wbs');
const userProfile = require('../models/userProfile');
const followUp = require('../models/followUp');
const taskEditSuggestion = require('../models/taskEditSuggestion');
const inventoryItem = require('../models/inventoryItem');
const title = require('../models/title');
const projectController = require('./projectController');

const { ObjectId } = mongoose.Types;
const PROJECT_ID = new ObjectId();
const WBS_ID = new ObjectId();
const TASK_IDS = [new ObjectId(), new ObjectId()];
const requestor = { requestorId: '65cf6c3706d8ac105827bb2e', role: 'Owner' };
const project = { _id: PROJECT_ID, projectName: 'Old Garden', isArchived: true };
const SUCCESS = { message: 'Project successfully deleted and user profiles updated.' };

let Project;
let res;

const run = (projectId = String(PROJECT_ID)) =>
  projectController(Project).deleteProject({ body: { requestor }, params: { projectId } }, res);

const expectResponse = (status, body) => {
  expect(res.status).toHaveBeenCalledWith(status);
  expect(res.send).toHaveBeenCalledTimes(1);
  expect(res.send).toHaveBeenCalledWith(body);
};

const expectRefusedUnchanged = (status, error) => {
  expectResponse(status, { error });
  [
    followUp.deleteMany,
    taskEditSuggestion.deleteMany,
    task.deleteMany,
    wbs.deleteMany,
    userProfile.updateMany,
    Project.deleteOne,
  ].forEach((write) => expect(write).not.toHaveBeenCalled());
};

// Answers exists() the way MongoDB would if this were the only time entry
const matchesEntry = (entry) => async (filter) =>
  filter.$or.some((condition) =>
    Object.entries(condition).every(([field, value]) =>
      value.$in ? value.$in.includes(entry[field]) : value === entry[field],
    ),
  );

const firstCall = (mockFn) => mockFn.mock.invocationCallOrder[0];

beforeEach(() => {
  jest.resetAllMocks();
  hasPermission.mockResolvedValue(true);
  Project = {
    findById: jest.fn().mockResolvedValue(project),
    deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
  };
  wbs.find.mockResolvedValue([{ _id: WBS_ID }]);
  task.find.mockResolvedValue(TASK_IDS.map((_id) => ({ _id, hoursLogged: 0 })));
  timeentry.exists.mockResolvedValue(false);
  inventoryItem.exists.mockResolvedValue(false);
  title.find.mockResolvedValue([]);
  followUp.deleteMany.mockResolvedValue({ deletedCount: 3 });
  taskEditSuggestion.deleteMany.mockResolvedValue({ deletedCount: 1 });
  task.deleteMany.mockResolvedValue({ deletedCount: 2 });
  wbs.deleteMany.mockResolvedValue({ deletedCount: 1 });
  userProfile.updateMany.mockResolvedValue({ nModified: 4 });
  wbs.exists.mockResolvedValue(false);
  res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
});

describe('projectController.deleteProject', () => {
  it('refuses with 403 when the requestor only has deleteProject', async () => {
    hasPermission.mockImplementation(async (_requestor, key) => key === 'deleteProject');

    await run();

    expect(hasPermission).toHaveBeenCalledTimes(1);
    expect(hasPermission).toHaveBeenCalledWith(requestor, 'deleteArchivedProject');
    expect(Project.findById).not.toHaveBeenCalled();
    expectRefusedUnchanged(403, 'You are not authorized to delete projects.');
  });

  it('refuses when the project does not exist', async () => {
    Project.findById.mockResolvedValue(null);

    await run();

    expect(Project.findById).toHaveBeenCalledWith(String(PROJECT_ID));
    expectRefusedUnchanged(400, 'No valid records found');
  });

  it('refuses a malformed id without looking it up', async () => {
    await run('not-an-id');

    expect(Project.findById).not.toHaveBeenCalled();
    expectRefusedUnchanged(400, 'No valid records found');
  });

  it('refuses a project that is not archived', async () => {
    Project.findById.mockResolvedValue({ ...project, isArchived: false });

    await run();

    expect(wbs.find).not.toHaveBeenCalled();
    expectRefusedUnchanged(400, 'Only archived projects can be deleted.');
  });

  it.each([
    ['the project id', { projectId: PROJECT_ID }],
    ['a task id stored in projectId (old entries)', { projectId: TASK_IDS[0] }],
    ['a WBS id', { wbsId: WBS_ID }],
    ['a task id', { taskId: TASK_IDS[1] }],
  ])('refuses when a time entry is linked by %s', async (_link, entry) => {
    timeentry.exists.mockImplementation(matchesEntry(entry));

    await run();

    expectRefusedUnchanged(400, 'This project has associated time entries and cannot be deleted.');
  });

  it('refuses when a task has logged hours', async () => {
    task.find.mockResolvedValue([
      { _id: TASK_IDS[0], hoursLogged: 0 },
      { _id: TASK_IDS[1], hoursLogged: 0.25 },
    ]);

    await run();

    expectRefusedUnchanged(400, 'This project has tasks with logged hours and cannot be deleted.');
  });

  it('ignores a float leftover that rounds to 0.00 hours', async () => {
    // What 6 + 12 minutes leave after both entries are deleted
    task.find.mockResolvedValue([
      { _id: TASK_IDS[0], hoursLogged: 2.7755575615628914e-17 },
      { _id: TASK_IDS[1], hoursLogged: 0 },
    ]);

    await run();

    expect(Project.deleteOne).toHaveBeenCalledWith({ _id: PROJECT_ID });
    expectResponse(200, SUCCESS);
  });

  it('refuses when an inventory item uses the project', async () => {
    inventoryItem.exists.mockResolvedValue(true);

    await run();

    expect(inventoryItem.exists).toHaveBeenCalledWith({ project: PROJECT_ID });
    expectRefusedUnchanged(400, 'This project has inventory items and cannot be deleted.');
  });

  it.each([
    ['Garden Lead', [{ titleName: 'Garden Lead' }]],
    ['Garden Lead, Garden Helper', [{ titleName: 'Garden Lead' }, { titleName: 'Garden Helper' }]],
  ])('refuses and names the Quick Setup titles that use the project: %s', async (names, titles) => {
    title.find.mockResolvedValue(titles);

    await run();

    expect(title.find).toHaveBeenCalledWith(
      { 'projectAssigned._id': String(PROJECT_ID) },
      'titleName',
    );
    expectRefusedUnchanged(
      400,
      `This project is used by these Quick Setup titles and cannot be deleted: ${names}.`,
    );
  });

  it('deletes exactly the checked records, children first, then the project', async () => {
    // Settles a tick later, so the reply must wait for it
    const projectDeleted = jest.fn();
    Project.deleteOne.mockImplementation(async () => {
      await new Promise(setImmediate);
      projectDeleted();
    });

    await run();

    const timeFilter = {
      $or: [
        { projectId: PROJECT_ID },
        { projectId: { $in: TASK_IDS } },
        { wbsId: { $in: [WBS_ID] } },
        { taskId: { $in: TASK_IDS } },
      ],
    };
    expect(wbs.find).toHaveBeenCalledWith({ projectId: PROJECT_ID }, '_id');
    expect(task.find).toHaveBeenCalledWith({ wbsId: { $in: [WBS_ID] } }, '_id hoursLogged');
    expect(timeentry.exists.mock.calls).toEqual([[timeFilter], [timeFilter]]);
    expect(followUp.deleteMany).toHaveBeenCalledWith({ taskId: { $in: TASK_IDS } });
    expect(taskEditSuggestion.deleteMany).toHaveBeenCalledWith({ taskId: { $in: TASK_IDS } });
    expect(task.deleteMany).toHaveBeenCalledWith({ _id: { $in: TASK_IDS } });
    expect(wbs.deleteMany).toHaveBeenCalledWith({ _id: { $in: [WBS_ID] } });
    expect(userProfile.updateMany).toHaveBeenCalledWith(
      { $or: [{ projects: PROJECT_ID }, { projectHistory: PROJECT_ID }] },
      { $pull: { projects: PROJECT_ID, projectHistory: PROJECT_ID } },
    );
    expect(wbs.exists).toHaveBeenCalledWith({ projectId: PROJECT_ID });
    expect(Project.deleteOne).toHaveBeenCalledWith({ _id: PROJECT_ID });
    expect(timeentry.deleteMany).not.toHaveBeenCalled();

    const order = [
      firstCall(followUp.deleteMany),
      firstCall(taskEditSuggestion.deleteMany),
      firstCall(task.deleteMany),
      firstCall(wbs.deleteMany),
      firstCall(userProfile.updateMany),
      timeentry.exists.mock.invocationCallOrder[1],
      firstCall(wbs.exists),
      firstCall(Project.deleteOne),
      firstCall(projectDeleted),
      firstCall(res.send),
    ];
    expect(order).toEqual([...order].sort((a, b) => a - b));

    expect(logger.logInfo).toHaveBeenCalledTimes(1);
    expect(logger.logInfo).toHaveBeenCalledWith(
      `Deleted archived project "Old Garden" (${PROJECT_ID}) by ${requestor.requestorId}: WBS 1, tasks 2, follow-ups 3, edit suggestions 1, profiles updated 4`,
    );
    expectResponse(200, SUCCESS);
  });

  it('skips the child deletes when the project has no WBS', async () => {
    wbs.find.mockResolvedValue([]);
    task.find.mockResolvedValue([]);

    await run();

    [followUp.deleteMany, taskEditSuggestion.deleteMany, task.deleteMany, wbs.deleteMany].forEach(
      (deleteMany) => expect(deleteMany).not.toHaveBeenCalled(),
    );
    expect(Project.deleteOne).toHaveBeenCalledWith({ _id: PROJECT_ID });
    expect(logger.logInfo).toHaveBeenCalledWith(
      expect.stringContaining('WBS 0, tasks 0, follow-ups 0, edit suggestions 0'),
    );
    expectResponse(200, SUCCESS);
  });

  it.each([
    [
      'a time entry',
      () => timeentry.exists.mockResolvedValueOnce(false).mockResolvedValueOnce(true),
    ],
    ['a WBS', () => wbs.exists.mockResolvedValue(true)],
  ])('keeps the project when %s is added during the delete', async (_added, arrange) => {
    arrange();

    await run();

    expect(userProfile.updateMany).toHaveBeenCalled();
    expect(Project.deleteOne).not.toHaveBeenCalled();
    expect(logger.logInfo).toHaveBeenCalledTimes(1);
    expect(logger.logInfo).toHaveBeenCalledWith(
      `Stopped deleting archived project "Old Garden" (${PROJECT_ID}) by ${requestor.requestorId}: time or a WBS was added meanwhile, project kept. Already removed: WBS 1, tasks 2, follow-ups 3, edit suggestions 1, profiles updated 4`,
    );
    expectResponse(400, {
      error:
        'Time or a WBS was added to this project during the delete, so the project was kept, but its earlier WBSs and tasks were removed.',
    });
  });

  it('logs an unexpected error and answers 500 without the raw error', async () => {
    const error = new Error('connection lost');
    task.deleteMany.mockRejectedValue(error);

    await run();

    expect(logger.logException).toHaveBeenCalledWith(error, 'projectController.deleteProject', {
      projectId: String(PROJECT_ID),
    });
    expect(Project.deleteOne).not.toHaveBeenCalled();
    expectResponse(500, { error: 'Error deleting project. Please try again.' });
  });
});
