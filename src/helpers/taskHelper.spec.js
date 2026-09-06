const mongoose = require('mongoose');

jest.mock('../models/userProfile');
jest.mock('../models/timeentry');
jest.mock('../models/team');
jest.mock('../models/task');
jest.mock('../models/taskNotification');
jest.mock('../utilities/permissions');

const userProfile = require('../models/userProfile');
const timeentry = require('../models/timeentry');
const team = require('../models/team');
const Task = require('../models/task');
const TaskNotification = require('../models/taskNotification');
const { hasPermission } = require('../utilities/permissions');
const taskHelperModule = require('./taskHelper');

const { isTaskActiveForUser, isTaskCompletedForUser } = taskHelperModule;
const { getTasksForTeams, getTasksForSingleUser, getUserProfileFirstAndLastName } =
  taskHelperModule();

const makeObjectId = () => new mongoose.Types.ObjectId();

const makeTaskDoc = ({ taskId, taskName, resources, projectId }) => ({
  _id: taskId,
  taskName,
  resources,
  isActive: true,
  wbsId: projectId,
});

const makePopulatedTask = ({ taskId, taskName, resources, projectId }) => ({
  _id: taskId,
  _doc: makeTaskDoc({ taskId, taskName, resources, projectId }),
  resources,
  wbsId: { projectId },
});

describe('taskHelper dashboard task filters', () => {
  const userId = 'user123';

  const makeTask = (overrides = {}) => ({
    isActive: true,
    resources: [{ userID: userId, completedTask: false }],
    ...overrides,
  });

  test('isTaskCompletedForUser returns true when user resource has completedTask true', () => {
    const task = makeTask({ resources: [{ userID: userId, completedTask: true }] });
    expect(isTaskCompletedForUser(task, userId)).toBe(true);
  });

  test('isTaskCompletedForUser returns false for active assignment', () => {
    expect(isTaskCompletedForUser(makeTask(), userId)).toBe(false);
  });

  test('isTaskCompletedForUser returns false when user has no resource entry', () => {
    const task = makeTask({ resources: [{ userID: 'someoneElse', completedTask: true }] });
    expect(isTaskCompletedForUser(task, userId)).toBe(false);
  });

  test('isTaskActiveForUser returns false for completed assignment', () => {
    const task = makeTask({ resources: [{ userID: userId, completedTask: true }] });
    expect(isTaskActiveForUser(task, userId)).toBe(false);
  });

  test('isTaskActiveForUser returns true for inactive tasks when not completed', () => {
    expect(isTaskActiveForUser(makeTask({ isActive: false }), userId)).toBe(true);
  });

  test('isTaskActiveForUser returns true for active non-completed assignment', () => {
    expect(isTaskActiveForUser(makeTask(), userId)).toBe(true);
  });

  test('per-user isolation: completed for A, active for B', () => {
    const task = makeTask({
      resources: [
        { userID: 'userA', completedTask: true },
        { userID: 'userB', completedTask: false },
      ],
    });
    expect(isTaskActiveForUser(task, 'userA')).toBe(false);
    expect(isTaskActiveForUser(task, 'userB')).toBe(true);
  });
});

describe('getTasksForTeams dashboard filtering', () => {
  const userId = makeObjectId();
  const teammateId = makeObjectId();
  const requestorId = makeObjectId();
  const projectId = makeObjectId();
  const activeTaskId = makeObjectId();
  const completedTaskId = makeObjectId();
  const sharedTaskId = makeObjectId();
  const notificationId = makeObjectId();

  const requestor = { requestorId: requestorId.toString(), role: 'Manager' };

  const teamMembers = [
    {
      _id: userId,
      role: 'Volunteer',
      firstName: 'Main',
      lastName: 'User',
      weeklycommittedHours: 10,
      weeklySummaryOption: null,
      weeklySummariesCount: 0,
      timeOffFrom: null,
      timeOffTill: null,
      teamCode: null,
      teams: [],
      adminLinks: null,
    },
    {
      _id: teammateId,
      role: 'Volunteer',
      firstName: 'Team',
      lastName: 'Mate',
      weeklycommittedHours: 5,
      weeklySummaryOption: null,
      weeklySummariesCount: 0,
      timeOffFrom: null,
      timeOffTill: null,
      teamCode: null,
      teams: [],
      adminLinks: null,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    hasPermission.mockResolvedValue(false);

    userProfile.findOne.mockResolvedValue({
      _id: userId,
      role: 'Volunteer',
      firstName: 'Main',
      lastName: 'User',
      weeklycommittedHours: 10,
      weeklySummaryOption: null,
      timeOffFrom: null,
      timeOffTill: null,
      teamCode: null,
      teams: [],
      adminLinks: null,
    });

    team.find.mockResolvedValue([
      {
        members: [
          { userId, visible: true },
          { userId: teammateId, visible: true },
        ],
      },
    ]);

    userProfile.find.mockReturnValue({
      populate: jest.fn().mockResolvedValue(teamMembers),
    });

    timeentry.find.mockResolvedValue([]);

    Task.find.mockReturnValue({
      populate: jest.fn().mockResolvedValue([
        makePopulatedTask({
          taskId: activeTaskId,
          taskName: 'Active Task',
          resources: [{ userID: userId, completedTask: false }],
          projectId,
        }),
        makePopulatedTask({
          taskId: completedTaskId,
          taskName: 'Completed Task',
          resources: [{ userID: userId, completedTask: true }],
          projectId,
        }),
        makePopulatedTask({
          taskId: sharedTaskId,
          taskName: 'Shared Task',
          resources: [
            { userID: userId, completedTask: true },
            { userID: teammateId, completedTask: false },
          ],
          projectId,
        }),
        makePopulatedTask({
          taskId: makeObjectId(),
          taskName: 'Missing Resource User',
          resources: [{ userID: null, completedTask: false }],
          projectId,
        }),
      ]),
    });

    TaskNotification.find.mockResolvedValue([
      {
        _id: notificationId,
        taskId: activeTaskId,
        userId,
      },
    ]);
  });

  test('excludes completed tasks, keeps active tasks, and sets completedTasksCount per user', async () => {
    const result = await getTasksForTeams(userId, requestor);

    expect(result).toHaveLength(2);

    const mainUser = result.find((entry) => entry.personId.toString() === userId.toString());
    const teammate = result.find((entry) => entry.personId.toString() === teammateId.toString());

    expect(mainUser.tasks).toHaveLength(1);
    expect(mainUser.tasks[0].taskName).toBe('Active Task');
    expect(mainUser.completedTasksCount).toBe(2);
    expect(mainUser.tasks[0].taskNotifications).toHaveLength(1);

    expect(teammate.tasks).toHaveLength(1);
    expect(teammate.tasks[0].taskName).toBe('Shared Task');
    expect(teammate.completedTasksCount).toBe(0);
  });

  test('returns null when user is not found', async () => {
    userProfile.findOne.mockResolvedValue(null);

    const result = await getTasksForTeams(userId, requestor);

    expect(result).toBeNull();
  });

  test('returns zero completedTasksCount when user has only active tasks', async () => {
    Task.find.mockReturnValue({
      populate: jest.fn().mockResolvedValue([
        makePopulatedTask({
          taskId: activeTaskId,
          taskName: 'Only Active',
          resources: [{ userID: teammateId, completedTask: false }],
          projectId,
        }),
      ]),
    });
    TaskNotification.find.mockResolvedValue([]);

    const result = await getTasksForTeams(userId, requestor);
    const teammate = result.find((entry) => entry.personId.toString() === teammateId.toString());

    expect(teammate.tasks).toHaveLength(1);
    expect(teammate.completedTasksCount).toBe(0);
  });

  test('uses owner-like case 1 when requestor and user both have dashboard access', async () => {
    hasPermission.mockResolvedValue(true);
    userProfile.find.mockReturnValue({
      populate: jest.fn().mockResolvedValue([teamMembers[0]]),
    });
    Task.find.mockReturnValue({
      populate: jest.fn().mockResolvedValue([
        makePopulatedTask({
          taskId: activeTaskId,
          taskName: 'Owner Case Task',
          resources: [{ userID: userId, completedTask: false }],
          projectId,
        }),
      ]),
    });
    TaskNotification.find.mockResolvedValue([]);

    const result = await getTasksForTeams(userId, requestor);

    expect(result).toHaveLength(1);
    expect(result[0].tasks[0].taskName).toBe('Owner Case Task');
    expect(userProfile.find).toHaveBeenCalledWith({ isActive: true }, expect.any(Object));
  });

  test('uses case 2 when requestor has dashboard access but target user does not', async () => {
    hasPermission.mockImplementation(async (actor) => actor.requestorId === requestorId.toString());
    team.find.mockResolvedValue([
      {
        members: [{ userId, visible: true }],
      },
    ]);
    userProfile.find.mockReturnValue({
      populate: jest.fn().mockResolvedValue([teamMembers[0]]),
    });
    Task.find.mockReturnValue({
      populate: jest.fn().mockResolvedValue([
        makePopulatedTask({
          taskId: activeTaskId,
          taskName: 'Case Two Task',
          resources: [{ userID: userId, completedTask: false }],
          projectId,
        }),
      ]),
    });
    TaskNotification.find.mockResolvedValue([]);

    const result = await getTasksForTeams(userId, requestor);

    expect(result).toHaveLength(1);
    expect(result[0].tasks[0].taskName).toBe('Case Two Task');
  });

  test('aggregates tangible and total time entries for team members', async () => {
    timeentry.find.mockResolvedValue([
      {
        personId: userId,
        totalSeconds: 7200,
        isTangible: true,
      },
      {
        personId: userId,
        totalSeconds: 1800,
        isTangible: false,
      },
    ]);

    const result = await getTasksForTeams(userId, requestor);
    const mainUser = result.find((entry) => entry.personId.toString() === userId.toString());

    expect(mainUser.totaltangibletime_hrs).toBe(2);
    expect(mainUser.totaltime_hrs).toBe(2.5);
  });

  test('groups multiple notifications and multiple active tasks for the same user', async () => {
    const secondActiveTaskId = makeObjectId();

    Task.find.mockReturnValue({
      populate: jest.fn().mockResolvedValue([
        makePopulatedTask({
          taskId: activeTaskId,
          taskName: 'Active One',
          resources: [{ userID: userId, completedTask: false }],
          projectId,
        }),
        makePopulatedTask({
          taskId: secondActiveTaskId,
          taskName: 'Active Two',
          resources: [{ userID: userId, completedTask: false }],
          projectId,
        }),
      ]),
    });
    TaskNotification.find.mockResolvedValue([
      { taskId: activeTaskId, userId },
      { taskId: activeTaskId, userId },
    ]);

    const result = await getTasksForTeams(userId, requestor);
    const mainUser = result.find((entry) => entry.personId.toString() === userId.toString());

    expect(mainUser.tasks).toHaveLength(2);
    expect(mainUser.tasks[0].taskNotifications).toHaveLength(2);
  });

  test('returns an Error when task lookup fails', async () => {
    Task.find.mockReturnValue({
      populate: jest.fn().mockRejectedValue(new Error('task lookup failed')),
    });

    const result = await getTasksForTeams(userId, requestor);

    expect(result).toBeInstanceOf(Error);
  });
});

describe('getTasksForSingleUser dashboard filtering', () => {
  test('builds aggregation pipeline with completedTasksCount and active-task filter', async () => {
    const userId = makeObjectId();
    const mockExec = jest.fn().mockResolvedValue([
      {
        personId: userId,
        name: 'Test User',
        tasks: [],
        completedTasksCount: 2,
      },
    ]);

    userProfile.aggregate.mockReturnValue({ exec: mockExec });

    const result = await getTasksForSingleUser(userId).exec();

    expect(userProfile.aggregate).toHaveBeenCalledTimes(1);
    const pipeline = userProfile.aggregate.mock.calls[0][0];

    const addFieldsStage = pipeline.find((stage) => stage.$addFields?.completedTasksCount);
    expect(addFieldsStage).toBeDefined();
    expect(addFieldsStage.$addFields.tasks.$filter).toBeDefined();
    expect(result[0].completedTasksCount).toBe(2);
  });
});

describe('getUserProfileFirstAndLastName', () => {
  test('returns full name when profile exists', async () => {
    userProfile.findById.mockReturnValue(Promise.resolve({ firstName: 'Purav', lastName: 'Test' }));

    const name = await getUserProfileFirstAndLastName(makeObjectId());

    expect(name).toBe('Purav Test');
  });

  test('returns blank name when profile is missing', async () => {
    userProfile.findById.mockReturnValue(Promise.resolve(null));

    const name = await getUserProfileFirstAndLastName(makeObjectId());

    expect(name).toBe(' ');
  });
});
