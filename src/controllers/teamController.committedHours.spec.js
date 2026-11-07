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

  test('returns committed hours and individual member hours for each team', async () => {
    const teams = [
      {
        _id: 'team-1',
        teamName: 'Team Alpha',
        members: [{ userId: memberId1 }, { userId: memberId2 }],
      },
      {
        _id: 'team-2',
        teamName: 'Team Beta',
        members: [{ _id: memberId3 }],
      },
    ];

    setTeams(teams);

    TimeEntry.aggregate
      .mockResolvedValueOnce([
        { _id: new mongoose.Types.ObjectId(memberId1), totalHours: 5.25 },
        { _id: new mongoose.Types.ObjectId(memberId2), totalHours: 7.25 },
      ])
      .mockResolvedValueOnce([{ _id: new mongoose.Types.ObjectId(memberId3), totalHours: 3.75 }]);

    await getTeamsCommittedHours(req, res);

    expect(Team.find).toHaveBeenCalledWith({ isActive: true });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([
      {
        teamId: 'team-1',
        teamName: 'Team Alpha',
        committedHours: 12.5,
        membersHours: [
          {
            userId: new mongoose.Types.ObjectId(memberId1),
            totalHours: 5.3,
          },
          {
            userId: new mongoose.Types.ObjectId(memberId2),
            totalHours: 7.3,
          },
        ],
      },
      {
        teamId: 'team-2',
        teamName: 'Team Beta',
        committedHours: 3.8,
        membersHours: [
          {
            userId: new mongoose.Types.ObjectId(memberId3),
            totalHours: 3.8,
          },
        ],
      },
    ]);
  });

  test('uses the expected team query and date range in the aggregation pipeline', async () => {
    setTeams([
      {
        _id: 'team-1',
        teamName: 'Team Alpha',
        members: [{ userId: memberId1 }],
      },
    ]);

    TimeEntry.aggregate.mockResolvedValue([]);

    await getTeamsCommittedHours(req, res);

    expect(Team.find).toHaveBeenCalledWith({ isActive: true });

    const pipeline = TimeEntry.aggregate.mock.calls[0][0];

    expect(pipeline[0]).toEqual({
      $match: {
        personId: {
          $in: [new mongoose.Types.ObjectId(memberId1)],
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
        totalHours: {
          $sum: { $divide: ['$totalSeconds', 3600] },
        },
      },
    });
  });

  test('returns an empty array when there are no active teams', async () => {
    setTeams([]);
    TimeEntry.aggregate.mockResolvedValue([]);

    await getTeamsCommittedHours(req, res);

    expect(TimeEntry.aggregate).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([]);
  });

  test('returns zero committed hours when a team has no members', async () => {
    setTeams([
      {
        _id: 'team-1',
        teamName: 'Empty Team',
      },
    ]);

    TimeEntry.aggregate.mockResolvedValue([]);

    await getTeamsCommittedHours(req, res);

    expect(TimeEntry.aggregate).toHaveBeenCalledWith([
      {
        $match: {
          personId: { $in: [] },
          dateOfWork: {
            $gte: '2026-01-01',
            $lte: '2026-01-31',
          },
          entryType: { $in: ['default', 'person', null] },
        },
      },
      {
        $group: {
          _id: '$personId',
          totalHours: {
            $sum: { $divide: ['$totalSeconds', 3600] },
          },
        },
      },
    ]);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([
      {
        teamId: 'team-1',
        teamName: 'Empty Team',
        committedHours: 0,
        membersHours: [],
      },
    ]);
  });

  test('returns zero committed hours when no time entries match', async () => {
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
        committedHours: 0,
        membersHours: [],
      },
    ]);
  });

  test('rounds committed hours and individual member hours to one decimal place', async () => {
    setTeams([
      {
        _id: 'team-1',
        teamName: 'Team Alpha',
        members: [{ userId: memberId1 }, { userId: memberId2 }],
      },
    ]);

    TimeEntry.aggregate.mockResolvedValue([
      { _id: new mongoose.Types.ObjectId(memberId1), totalHours: 1.26 },
      { _id: new mongoose.Types.ObjectId(memberId2), totalHours: 2.24 },
    ]);

    await getTeamsCommittedHours(req, res);

    expect(res.json).toHaveBeenCalledWith([
      {
        teamId: 'team-1',
        teamName: 'Team Alpha',
        committedHours: 3.5,
        membersHours: [
          {
            userId: new mongoose.Types.ObjectId(memberId1),
            totalHours: 1.3,
          },
          {
            userId: new mongoose.Types.ObjectId(memberId2),
            totalHours: 2.2,
          },
        ],
      },
    ]);
  });

  test('logs the error and returns HTTP 500 when fetching teams fails', async () => {
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

  test('logs the error and returns HTTP 500 when aggregating time entries fails', async () => {
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
