jest.mock('../models/timeentry', () => ({
  aggregate: jest.fn(),
}));

jest.mock('../startup/logger', () => ({
  logInfo: jest.fn(),
  logException: jest.fn(),
}));

const mongoose = require('mongoose');
const TimeEntry = require('../models/timeentry');
const Logger = require('../startup/logger');
const teamController = require('./teamController');

describe('getTeamsCommittedHours', () => {
  let Team;
  let getTeamsCommittedHours;
  let req;
  let res;

  const memberId1 = '507f1f77bcf86cd799439011';
  const memberId2 = '507f1f77bcf86cd799439012';
  const memberId3 = '507f1f77bcf86cd799439013';

  const setTeams = (teams) => {
    const lean = jest.fn().mockResolvedValue(teams);
    const select = jest.fn().mockReturnValue({ lean });

    Team.find.mockReturnValue({ select });

    return { select, lean };
  };

  beforeEach(() => {
    jest.clearAllMocks();

    Team = {
      find: jest.fn(),
    };

    ({ getTeamsCommittedHours } = teamController(Team));

    req = {
      body: {
        fromDate: '2026-01-01',
        toDate: '2026-01-31',
      },
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  test('returns actual logged hours and individual member hours for each team', async () => {
    setTeams([
      {
        _id: 'team-1',
        teamName: 'Team Alpha',
        members: [{ userId: memberId1 }, { userId: memberId2 }],
      },
      {
        _id: 'team-2',
        teamName: 'Team Beta',
        members: [{ userId: memberId3 }],
      },
    ]);

    TimeEntry.aggregate.mockResolvedValue([
      {
        _id: new mongoose.Types.ObjectId(memberId1),
        totalSeconds: 18900,
      },
      {
        _id: new mongoose.Types.ObjectId(memberId2),
        totalSeconds: 26100,
      },
      {
        _id: new mongoose.Types.ObjectId(memberId3),
        totalSeconds: 13500,
      },
    ]);

    await getTeamsCommittedHours(req, res);

    expect(Team.find).toHaveBeenCalledWith({ isActive: true });
    expect(Team.find).toHaveBeenCalledTimes(1);
    expect(TimeEntry.aggregate).toHaveBeenCalledTimes(1);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([
      {
        teamId: 'team-1',
        teamName: 'Team Alpha',
        loggedHours: 12.5,
        membersHours: [
          {
            userId: memberId1,
            totalHours: 5.3,
          },
          {
            userId: memberId2,
            totalHours: 7.3,
          },
        ],
      },
      {
        teamId: 'team-2',
        teamName: 'Team Beta',
        loggedHours: 3.8,
        membersHours: [
          {
            userId: memberId3,
            totalHours: 3.8,
          },
        ],
      },
    ]);
  });

  test('uses one aggregation for all team members with the expected date and entry-type filters', async () => {
    setTeams([
      {
        _id: 'team-1',
        teamName: 'Team Alpha',
        members: [{ userId: memberId1 }, { userId: memberId2 }],
      },
      {
        _id: 'team-2',
        teamName: 'Team Beta',
        members: [{ userId: memberId3 }],
      },
    ]);

    TimeEntry.aggregate.mockResolvedValue([]);

    await getTeamsCommittedHours(req, res);

    expect(TimeEntry.aggregate).toHaveBeenCalledTimes(1);

    const pipeline = TimeEntry.aggregate.mock.calls[0][0];

    expect(pipeline[0]).toEqual({
      $match: {
        personId: {
          $in: [
            new mongoose.Types.ObjectId(memberId1),
            new mongoose.Types.ObjectId(memberId2),
            new mongoose.Types.ObjectId(memberId3),
          ],
        },
        dateOfWork: {
          $gte: '2026-01-01',
          $lte: '2026-01-31',
        },
        entryType: { $in: ['default', 'person', null] },
      },
    });

    expect(pipeline[1]).toEqual({
      $group: {
        _id: '$personId',
        totalSeconds: {
          $sum: { $ifNull: ['$totalSeconds', 0] },
        },
      },
    });
  });

  test('does not duplicate member IDs when a member belongs to multiple teams', async () => {
    setTeams([
      {
        _id: 'team-1',
        teamName: 'Team Alpha',
        members: [{ userId: memberId1 }],
      },
      {
        _id: 'team-2',
        teamName: 'Team Beta',
        members: [{ userId: memberId1 }],
      },
    ]);

    TimeEntry.aggregate.mockResolvedValue([
      {
        _id: new mongoose.Types.ObjectId(memberId1),
        totalSeconds: 18000,
      },
    ]);

    await getTeamsCommittedHours(req, res);

    const pipeline = TimeEntry.aggregate.mock.calls[0][0];

    expect(pipeline[0].$match.personId.$in).toHaveLength(1);

    expect(res.json).toHaveBeenCalledWith([
      {
        teamId: 'team-1',
        teamName: 'Team Alpha',
        loggedHours: 5,
        membersHours: [
          {
            userId: memberId1,
            totalHours: 5,
          },
        ],
      },
      {
        teamId: 'team-2',
        teamName: 'Team Beta',
        loggedHours: 5,
        membersHours: [
          {
            userId: memberId1,
            totalHours: 5,
          },
        ],
      },
    ]);
  });

  test('returns an empty array when there are no active teams', async () => {
    setTeams([]);

    await getTeamsCommittedHours(req, res);

    expect(TimeEntry.aggregate).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([]);
  });

  test('returns zero logged hours when a team has no members', async () => {
    setTeams([
      {
        _id: 'team-1',
        teamName: 'Empty Team',
        members: [],
      },
    ]);

    await getTeamsCommittedHours(req, res);

    expect(TimeEntry.aggregate).not.toHaveBeenCalled();

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([
      {
        teamId: 'team-1',
        teamName: 'Empty Team',
        loggedHours: 0,
        membersHours: [],
      },
    ]);
  });

  test('returns zero logged hours when no time entries match', async () => {
    setTeams([
      {
        _id: 'team-1',
        teamName: 'Team Alpha',
        members: [{ userId: memberId1 }],
      },
    ]);

    TimeEntry.aggregate.mockResolvedValue([]);

    await getTeamsCommittedHours(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([
      {
        teamId: 'team-1',
        teamName: 'Team Alpha',
        loggedHours: 0,
        membersHours: [],
      },
    ]);
  });

  test('rounds individual member hours and team total to one decimal place', async () => {
    setTeams([
      {
        _id: 'team-1',
        teamName: 'Team Alpha',
        members: [{ userId: memberId1 }, { userId: memberId2 }],
      },
    ]);

    TimeEntry.aggregate.mockResolvedValue([
      {
        _id: new mongoose.Types.ObjectId(memberId1),
        totalSeconds: 4536,
      },
      {
        _id: new mongoose.Types.ObjectId(memberId2),
        totalSeconds: 8064,
      },
    ]);

    await getTeamsCommittedHours(req, res);

    expect(res.json).toHaveBeenCalledWith([
      {
        teamId: 'team-1',
        teamName: 'Team Alpha',
        loggedHours: 3.5,
        membersHours: [
          {
            userId: memberId1,
            totalHours: 1.3,
          },
          {
            userId: memberId2,
            totalHours: 2.2,
          },
        ],
      },
    ]);
  });

  test.each([
    [{ fromDate: '2026-01-01' }, 'missing toDate'],
    [{ toDate: '2026-01-31' }, 'missing fromDate'],
    [{}, 'both dates missing'],
    [{ fromDate: 'invalid-date', toDate: '2026-01-31' }, 'invalid fromDate'],
    [{ fromDate: '2026-01-01', toDate: 'invalid-date' }, 'invalid toDate'],
    [{ fromDate: '2026-02-30', toDate: '2026-03-01' }, 'impossible calendar date'],
    [{ fromDate: '2026-01-31', toDate: '2026-01-01' }, 'toDate before fromDate'],
  ])('returns HTTP 400 for invalid date input: %s (%s)', async (body) => {
    req.body = body;

    await getTeamsCommittedHours(req, res);

    expect(Team.find).not.toHaveBeenCalled();
    expect(TimeEntry.aggregate).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: expect.any(String),
    });
  });

  test('returns HTTP 500 and logs the error when fetching teams fails', async () => {
    const error = new Error('Team query failed');

    const lean = jest.fn().mockRejectedValue(error);
    const select = jest.fn().mockReturnValue({ lean });

    Team.find.mockReturnValue({ select });

    await getTeamsCommittedHours(req, res);

    expect(Logger.logException).toHaveBeenCalledWith(error);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Error calculating team member hours',
      error: 'Team query failed',
    });
  });

  test('returns HTTP 500 and logs the error when time-entry aggregation fails', async () => {
    const error = new Error('Time entry aggregation failed');

    setTeams([
      {
        _id: 'team-1',
        teamName: 'Team Alpha',
        members: [{ userId: memberId1 }],
      },
    ]);

    TimeEntry.aggregate.mockRejectedValue(error);

    await getTeamsCommittedHours(req, res);

    expect(Logger.logException).toHaveBeenCalledWith(error);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Error calculating team member hours',
      error: 'Time entry aggregation failed',
    });
  });
});
