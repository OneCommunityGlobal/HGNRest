const mongoose = require('mongoose');
const moment = require('moment-timezone');
const { MongoMemoryServer } = require('mongodb-memory-server');
const dashboardHelper = require('./dashboardhelper');
const overviewReportHelper = require('./overviewReportHelper');

describe('Total Org Summary hours', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri(), {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('matches the Leaderboard total for the same date range', async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const zeroCommitUserId = new mongoose.Types.ObjectId();
    const mentorId = new mongoose.Types.ObjectId();
    const inactiveUserId = new mongoose.Types.ObjectId();
    const dateOfWork = moment().tz('America/Los_Angeles').format('YYYY-MM-DD');

    await mongoose.connection.collection('rolesMergedPermissions').insertOne({
      roleName: 'Owner',
      permissions: ['seeUsersInDashboard'],
    });

    await mongoose.connection.collection('userProfiles').insertMany([
      { _id: ownerId, firstName: 'Test', lastName: 'Owner', role: 'Owner', isActive: true },
      {
        _id: zeroCommitUserId,
        firstName: 'Zero',
        lastName: 'Commitment',
        role: 'Volunteer',
        weeklycommittedHours: 0,
        isActive: true,
      },
      {
        _id: mentorId,
        firstName: 'Test',
        lastName: 'Mentor',
        role: 'Mentor',
        weeklycommittedHours: 10,
        isActive: true,
      },
      {
        _id: inactiveUserId,
        firstName: 'Inactive',
        lastName: 'User',
        role: 'Volunteer',
        weeklycommittedHours: 10,
        isActive: false,
      },
    ]);

    await mongoose.connection.collection('timeEntries').insertMany([
      {
        personId: zeroCommitUserId,
        entryType: 'default',
        dateOfWork,
        totalSeconds: 2 * 3600,
        isTangible: true,
        isActive: true,
      },
      {
        personId: zeroCommitUserId,
        entryType: 'project',
        dateOfWork,
        totalSeconds: 1 * 3600,
        isTangible: true,
        isActive: true,
      },
      {
        personId: mentorId,
        entryType: 'default',
        dateOfWork,
        totalSeconds: 3 * 3600,
        isTangible: false,
        isActive: true,
      },
      {
        personId: mentorId,
        entryType: 'default',
        dateOfWork,
        totalSeconds: 7 * 3600,
        isTangible: true,
        isActive: false,
      },
      {
        personId: inactiveUserId,
        entryType: 'default',
        dateOfWork,
        totalSeconds: 9 * 3600,
        isTangible: true,
        isActive: true,
      },
    ]);

    const leaderboard = await dashboardHelper().getLeaderboard(ownerId);
    const leaderboardTotal = leaderboard.reduce((total, user) => total + user.totaltime_hrs, 0);
    const reportTotal = await overviewReportHelper().getTotalHoursWorked(dateOfWork, dateOfWork);

    expect(leaderboardTotal).toBe(6);
    expect(reportTotal.current).toBe(leaderboardTotal);
  });
});
