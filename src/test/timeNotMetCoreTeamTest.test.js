/* eslint-disable */
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const UserBuilder = require('./factories/testUserBuilder');
const TimeEntryBuilder = require('./factories/testTimeEntryBuilder');

const UserProfile = require('../models/userProfile');
const TimeEntry = require('../models/timeentry');

const userHelper = require('../helpers/userHelper')();

const WEEKLY_SUMMARY =
  'Lorem ipsum dolor sit amet consectetur adipiscing elit quisque faucibus ex sapien vitae pellentesque sem placerat in id cursus mi pretium tellus duis convallis tempus leo eu aenean sed diam urna tempor pulvinar vivamus fringilla lacus nec metus bibendum egestas iaculis massa nisl malesuada lacinia integer nunc posuere ut hendrerit semper vel class aptent taciti.';

jest.mock('../helpers/dashboardhelper', () => jest.requireActual('../helpers/dashboardhelper'));
jest.mock('../utilities/emailSender');
jest.mock('../startup/logger');
jest.mock('../services/notificationService', () => ({
  createNotification: jest.fn().mockResolvedValue(undefined),
}));

jest.setTimeout(90_000);

const shouldSkipTests = process.env.CI || process.env.GITHUB_ACTIONS;

if (shouldSkipTests) {
  console.log(
    '⚠️  Skipping Time Not Met Core Team integration tests in CI (MongoDB not available)',
  );
}

(shouldSkipTests ? describe.skip : describe)('Time Not Met Core Team Test', () => {
  let mongoServer;
  let realDate;

  let now;
  let lastWeekStart;
  let lastWeekEnd;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  beforeEach(async () => {
    await UserProfile.deleteMany({});
    await TimeEntry.deleteMany({});
    const sundayPST = moment.tz('2025-11-09 00:10:00', 'America/Los_Angeles');
    realDate = Date.now;
    global.Date.now = jest.fn(() => sundayPST.valueOf());

    now = moment.tz('America/Los_Angeles');
    lastWeekStart = now.clone().startOf('week').subtract(1, 'week');
    lastWeekEnd = now.clone().endOf('week').subtract(1, 'week');
  });

  afterEach(() => {
    global.Date.now = realDate;
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  describe('Less than 5 Blue Squares', () => {
    it('should not assign blue square if no missed hours', async () => {
      const user = await new UserBuilder().withWeeklySummary(WEEKLY_SUMMARY).buildAndSave();

      await new TimeEntryBuilder()
        .addEntry(user._id, lastWeekStart.clone().add(1, 'day').format('YYYY-MM-DD'), 4)
        .addEntry(user._id, lastWeekStart.clone().add(3, 'days').format('YYYY-MM-DD'), 4)
        .addEntry(user._id, lastWeekStart.clone().add(5, 'days').format('YYYY-MM-DD'), 2)
        .buildAndSave();

      await userHelper.assignBlueSquareForTimeNotMet();
      await userHelper.applyMissedHourForCoreTeam();

      const updatedUser = await UserProfile.findById(user._id);

      expect(updatedUser.infringements.length).toBe(0);
      expect(updatedUser.missedHours).toBe(0);
    });

    it('should assign first blue square when 2 hours missed (8/10)', async () => {
      const user = await new UserBuilder().withWeeklySummary(WEEKLY_SUMMARY).buildAndSave();

      await new TimeEntryBuilder()
        .addEntry(user._id, lastWeekStart.clone().add(1, 'day').format('YYYY-MM-DD'), 3)
        .addEntry(user._id, lastWeekStart.clone().add(3, 'days').format('YYYY-MM-DD'), 5)
        .buildAndSave();

      await userHelper.applyMissedHourForCoreTeam();
      await userHelper.assignBlueSquareForTimeNotMet();

      const updatedUser = await UserProfile.findById(user._id);

      expect(updatedUser.infringements.length).toBe(1);
      expect(updatedUser.missedHours).toBe(2);
    });

    it('Tatyana scenario: 5h commitment, 3h logged, next week requires 7h carryover', async () => {
      const user = await new UserBuilder()
        .withCommittedHours(5)
        .withWeeklySummary(WEEKLY_SUMMARY)
        .buildAndSave();

      await new TimeEntryBuilder()
        .addEntry(user._id, lastWeekStart.clone().add(1, 'day').format('YYYY-MM-DD'), 3)
        .buildAndSave();

      await userHelper.assignBlueSquareForTimeNotMet();
      await userHelper.applyMissedHourForCoreTeam();

      const updatedUser = await UserProfile.findById(user._id);
      expect(updatedUser.infringements.length).toBe(1);
      expect(updatedUser.missedHours).toBe(2);
    });
  });

  describe('More than 5 Blue Squares ', () => {
    it('should maintain 6 infringements and 0 missed hours when logging required hours including penalty', async () => {
      const user = await new UserBuilder()
        .withInfringements(6)
        .withWeeklySummary(WEEKLY_SUMMARY)
        .buildAndSave();

      // 6 infringements => 7th incoming adds +2 penalty; required = 10 + 2 = 12
      await new TimeEntryBuilder()
        .addEntry(user._id, lastWeekStart.clone().add(1, 'day').format('YYYY-MM-DD'), 6)
        .addEntry(user._id, lastWeekStart.clone().add(3, 'days').format('YYYY-MM-DD'), 6)
        .buildAndSave();

      await userHelper.assignBlueSquareForTimeNotMet();
      await userHelper.applyMissedHourForCoreTeam();

      const updatedUser = await UserProfile.findById(user._id);

      expect(updatedUser.infringements.length).toBe(6);
      expect(updatedUser.missedHours).toBe(0);
    });

    it('should only carry forward missed hours with a penalty hours', async () => {
      const user = await new UserBuilder()
        .withInfringements(6)
        .withMissessedHours(3)
        .withWeeklySummary(WEEKLY_SUMMARY)
        .buildAndSave();

      await new TimeEntryBuilder()
        .addEntry(user._id, lastWeekStart.clone().add(2, 'day').format('YYYY-MM-DD'), 4)
        .addEntry(user._id, lastWeekStart.clone().add(4, 'days').format('YYYY-MM-DD'), 4)
        .buildAndSave();

      await userHelper.assignBlueSquareForTimeNotMet();
      await userHelper.applyMissedHourForCoreTeam();

      const updatedUser = await UserProfile.findById(user._id);

      expect(updatedUser.infringements.length).toBe(7);
      expect(updatedUser.missedHours).toBe(6);
    });

    it('should only add missed hours (no penalty) for 5th blue square', async () => {
      const user = await new UserBuilder()
        .withInfringements(4)
        .withWeeklySummary(WEEKLY_SUMMARY)
        .buildAndSave();

      await new TimeEntryBuilder()
        .addEntry(user._id, lastWeekStart.clone().add(2, 'day').format('YYYY-MM-DD'), 3)
        .addEntry(user._id, lastWeekStart.clone().add(4, 'days').format('YYYY-MM-DD'), 4)
        .buildAndSave();

      await userHelper.assignBlueSquareForTimeNotMet();
      await userHelper.applyMissedHourForCoreTeam();

      const updatedUser = await UserProfile.findById(user._id);

      expect(updatedUser.infringements.length).toBe(5);
      expect(updatedUser.missedHours).toBe(3);
    });

    it('Tatyana 6th blue square: X=5, Y=3, missed carryover = 2+1 = 3 (next week total 8)', async () => {
      const user = await new UserBuilder()
        .withCommittedHours(5)
        .withInfringements(5)
        .withWeeklySummary(WEEKLY_SUMMARY)
        .buildAndSave();

      await new TimeEntryBuilder()
        .addEntry(user._id, lastWeekStart.clone().add(1, 'day').format('YYYY-MM-DD'), 3)
        .buildAndSave();

      await userHelper.assignBlueSquareForTimeNotMet();
      await userHelper.applyMissedHourForCoreTeam();

      const updatedUser = await UserProfile.findById(user._id);
      expect(updatedUser.infringements.length).toBe(6);
      expect(updatedUser.missedHours).toBe(3);
    });

    it('Tatyana 7th blue square: prior missed=3, X=5, Z=2, next week total = 12', async () => {
      const user = await new UserBuilder()
        .withCommittedHours(5)
        .withInfringements(6)
        .withMissessedHours(3)
        .withWeeklySummary(WEEKLY_SUMMARY)
        .buildAndSave();

      await new TimeEntryBuilder()
        .addEntry(user._id, lastWeekStart.clone().add(1, 'day').format('YYYY-MM-DD'), 2)
        .buildAndSave();

      await userHelper.assignBlueSquareForTimeNotMet();
      await userHelper.applyMissedHourForCoreTeam();

      const updatedUser = await UserProfile.findById(user._id);
      expect(updatedUser.infringements.length).toBe(7);
      expect(updatedUser.missedHours).toBe(7);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero committed hours scenario', async () => {
      const user = await new UserBuilder()
        .withCommittedHours(0)
        .withWeeklySummary(WEEKLY_SUMMARY)
        .buildAndSave();

      await userHelper.assignBlueSquareForTimeNotMet();
      await userHelper.applyMissedHourForCoreTeam();

      const updatedUser = await UserProfile.findById(user._id);
      expect(updatedUser.infringements.length).toBe(0);
      expect(updatedUser.missedHours).toBe(0);
    });

    it('should handle user with no time entries at all', async () => {
      const user = await new UserBuilder().withWeeklySummary(WEEKLY_SUMMARY).buildAndSave();

      await userHelper.assignBlueSquareForTimeNotMet();
      await userHelper.applyMissedHourForCoreTeam();

      const updatedUser = await UserProfile.findById(user._id);
      expect(updatedUser.infringements.length).toBe(1);
      expect(updatedUser.missedHours).toBe(10);
    });

    it('should not assign additional hours for non-Core Team members', async () => {
      const user = await new UserBuilder()
        .withWeeklySummary(WEEKLY_SUMMARY)
        .asVolunteer()
        .buildAndSave();

      await userHelper.assignBlueSquareForTimeNotMet();
      await userHelper.applyMissedHourForCoreTeam();

      const updatedUser = await UserProfile.findById(user._id);
      expect(updatedUser.infringements.length).toBe(1);
      expect(updatedUser.missedHours).toBe(0);
    });

    it('should not assign penalty hours when blue squares > 5 but time entries meet required hours including penalty', async () => {
      const user = await new UserBuilder()
        .withInfringements(6)
        .withWeeklySummary(WEEKLY_SUMMARY)
        .buildAndSave();

      await new TimeEntryBuilder()
        .addEntry(user._id, lastWeekStart.clone().add(1, 'day').format('YYYY-MM-DD'), 6)
        .addEntry(user._id, lastWeekStart.clone().add(3, 'days').format('YYYY-MM-DD'), 6)
        .buildAndSave();

      await userHelper.assignBlueSquareForTimeNotMet();
      await userHelper.applyMissedHourForCoreTeam();

      const updatedUser = await UserProfile.findById(user._id);

      expect(updatedUser.infringements.length).toBe(6);
      expect(updatedUser.missedHours).toBe(0);
    });
  });
});
