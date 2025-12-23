/* eslint-disable */
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const UserBuilder = require("./factories/testUserBuilder");
const TimeEntryBuilder = require("./factories/testTimeEntryBuilder");

// Import models first
const UserProfile = require('../models/userProfile');
const TimeEntry = require('../models/timeentry');
const createUser = require('./db/createUser');

const userHelper = require('../helpers/userHelper')();

const WEEKLY_SUMMARY = "Lorem ipsum dolor sit amet consectetur adipiscing elit quisque faucibus ex sapien vitae pellentesque sem placerat in id cursus mi pretium tellus duis convallis tempus leo eu aenean sed diam urna tempor pulvinar vivamus fringilla lacus nec metus bibendum egestas iaculis massa nisl malesuada lacinia integer nunc posuere ut hendrerit semper vel class aptent taciti."
// Mock other dependencies
jest.mock('../helpers/dashboardhelper');
jest.mock('../utilities/emailSender');
jest.mock('../startup/logger');

describe('Time Not Met Core Team Test', () => {
  let mongoServer;
  let userProfileModel;
  let timeEntryModel;
  let realDate;

  let now, lastWeekStart, lastWeekEnd;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    // Initialize models
    userProfileModel = UserProfile;
    timeEntryModel = TimeEntry;
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
    await mongoose.disconnect();
    await mongoServer.stop();
  });


  describe('Less than 5 Blue Squares', () => {
    it('should not assign blue square if no missed hours', async () => {
      // 1. Create test user

      const user = await new UserBuilder().withWeeklySummary(WEEKLY_SUMMARY).buildAndSave();

      // 2. Create test entries with properly formatted string dates

      const timeEntryBuilder = await new TimeEntryBuilder().addEntry(
        user._id,
        lastWeekStart.clone().add(1, 'day').format('YYYY-MM-DD'), // Monday
        4 // 4 hours
      ).addEntry(
        user._id,
        lastWeekStart.clone().add(3, 'days').format('YYYY-MM-DD'), // Wednesday
        4 // 4 hours
      ).addEntry(
        user._id,
        lastWeekStart.clone().add(5, 'days').format('YYYY-MM-DD'), // Friday
        2 // 2 hours
      ).buildAndSave();

      // 4. Final assertions
      await userHelper.assignBlueSquareForTimeNotMet();
      await userHelper.applyMissedHourForCoreTeam();

      const updatedUser = await UserProfile.findById(user._id);

      expect(updatedUser.infringements.length).toBe(0);
      expect(updatedUser.missedHours).toBe(0);
    });

    it('should assign first blue square when 2 hours missed (8/10)', async () => {
      // 1. Create test user with no existing infringements

      const user = await new UserBuilder().withWeeklySummary(WEEKLY_SUMMARY).buildAndSave();

      // 2. Create time entries totaling 8 hours (2 hours short)
      const timeEntryBuilder = await new TimeEntryBuilder().addEntry(
        user._id,
        lastWeekStart.clone().add(1, 'day').format('YYYY-MM-DD'), // Monday
        3 // 3 hours
      ).addEntry(
        user._id,
        lastWeekStart.clone().add(3, 'days').format('YYYY-MM-DD'), // Wednesday
        5 // 5 hours
      ).buildAndSave();

      // 3. Execute the blue square assignment
      await userHelper.applyMissedHourForCoreTeam();
      await userHelper.assignBlueSquareForTimeNotMet();

      // 4. Verify results
      const updatedUser = await UserProfile.findById(user._id);

      // Should have exactly 1 new infringement (blue square)
      expect(updatedUser.infringements.length).toBe(1);
      // Should show 2 missed hours (10 committed - 8 worked)
      expect(updatedUser.missedHours).toBe(2);
    });

  });

  describe('More than 5 Blue Squares ', () => {
    it('should maintain 6 infringements and 0 missed hours when logging exact committed hours', async () => {
      // 6 existing infringements
      const user = await new UserBuilder().withInfringements(6).withWeeklySummary(WEEKLY_SUMMARY).buildAndSave();

      // 10 hours (2 entries of 5 hours) - exactly meets commitment
      const timeEntryBuilder = await new TimeEntryBuilder().addEntry(
        user._id,
        lastWeekStart.clone().add(1, 'day').format('YYYY-MM-DD'),
        5 // 5 hours
      ).addEntry(
        user._id,
        lastWeekStart.clone().add(3, 'days').format('YYYY-MM-DD'),
        5 // 5 hours
      ).buildAndSave();

      // Execute
      await userHelper.assignBlueSquareForTimeNotMet();
      await userHelper.applyMissedHourForCoreTeam();

      // Verify
      const updatedUser = await UserProfile.findById(user._id);
      // did not miss any hours so nothing changes
      expect(updatedUser.infringements.length).toBe(6);
      expect(updatedUser.missedHours).toBe(0);
    });

    it('should only carry forward missed hours with a penalty hours', async () => {
      // Create user with 6 existing blue squares and 3 missed hours

      const user = await new UserBuilder().withInfringements(6).withMissessedHours(3).withWeeklySummary(WEEKLY_SUMMARY).buildAndSave();

      // Log only 8 hours this week (2 hours short)
      const timeEntryBuilder = await new TimeEntryBuilder().addEntry(
        user._id,
        lastWeekStart.clone().add(2, 'day').format('YYYY-MM-DD'),
        4 // 4 hours
      ).addEntry(
        user._id,
        lastWeekStart.clone().add(4, 'days').format('YYYY-MM-DD'),
        4 // 4 hours
      ).buildAndSave();

      // Execute the functions
      await userHelper.assignBlueSquareForTimeNotMet();
      await userHelper.applyMissedHourForCoreTeam();

      // Verify Week 6 results
      const updatedUser = await UserProfile.findById(user._id);

      // Should have 7 infringements (added new one for this week)
      expect(updatedUser.infringements.length).toBe(7);

      // Should have 6 missed hours (3 previous + 2 new + 1 penalty (more than 5 blue squares))
      expect(updatedUser.missedHours).toBe(6);
    });

    it('should only add missed hours (no penalty) for 5th blue square', async () => {
      // 1. Create user with 4 Blue Squares
      const user = await new UserBuilder().withInfringements(4).withWeeklySummary(WEEKLY_SUMMARY).buildAndSave();

      // Log only 7 hours (3 hours short)
      const timeEntryBuilder = await new TimeEntryBuilder().addEntry(
        user._id,
        lastWeekStart.clone().add(2, 'day').format('YYYY-MM-DD'),
        3 // 3 hours
      ).addEntry(
        user._id,
        lastWeekStart.clone().add(4, 'days').format('YYYY-MM-DD'),
        4 // 4 hours
      ).buildAndSave();

      // Execute the functions
      await userHelper.assignBlueSquareForTimeNotMet();
      await userHelper.applyMissedHourForCoreTeam();

      // Verify results
      const updatedUser = await UserProfile.findById(user._id);

      // Should have exactly 5 infringements (added the 5th)
      expect(updatedUser.infringements.length).toBe(5);

      // Should only carry forward missed hours (no penalty yet)
      // Missed hours: 10 - 7 = 3
      expect(updatedUser.missedHours).toBe(3);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero committed hours scenario', async () => {
      // User with 0 committed hours shouldn't get infringements
      const user = await new UserBuilder().withCommittedHours(0).withWeeklySummary(WEEKLY_SUMMARY).buildAndSave();

      await userHelper.assignBlueSquareForTimeNotMet();
      await userHelper.applyMissedHourForCoreTeam();

      const updatedUser = await UserProfile.findById(user._id);
      expect(updatedUser.infringements.length).toBe(0);
      expect(updatedUser.missedHours).toBe(0);
    });

    it('should handle user with no time entries at all', async () => {
      // User with no time entries should get full missed hours
      const user = await new UserBuilder().withWeeklySummary(WEEKLY_SUMMARY).buildAndSave();

      // No time entries

      await userHelper.assignBlueSquareForTimeNotMet();
      await userHelper.applyMissedHourForCoreTeam();

      const updatedUser = await UserProfile.findById(user._id);
      expect(updatedUser.infringements.length).toBe(1);
      expect(updatedUser.missedHours).toBe(10);
    });

    it('should not assign additional hours for non-Core Team members', async () => {
      const user = await new UserBuilder().withWeeklySummary(WEEKLY_SUMMARY).asVolunteer().buildAndSave();

      // No time entries = would normally trigger blue square
      await userHelper.assignBlueSquareForTimeNotMet();
      await userHelper.applyMissedHourForCoreTeam();

      const updatedUser = await UserProfile.findById(user._id);
      expect(updatedUser.infringements.length).toBe(1);
      expect(updatedUser.missedHours).toBe(0); // Non-Core Team doesn't accumulate missed hours
    });


    it('should not assign penalty hours when blue squares > 5 but time entries meet committed hours', async () => {
      // Create user with 5 existing blue squares
      const user = await new UserBuilder().withInfringements(6).withWeeklySummary(WEEKLY_SUMMARY).buildAndSave();

      const timeEntryBuilder = await new TimeEntryBuilder().addEntry(
        user._id,
        lastWeekStart.clone().add(1, 'day').format('YYYY-MM-DD'),
        5 // 5 hours
      ).addEntry(
        user._id,
        lastWeekStart.clone().add(3, 'days').format('YYYY-MM-DD'),
        5 // 5 hours
      ).buildAndSave();

      await userHelper.assignBlueSquareForTimeNotMet();
      await userHelper.applyMissedHourForCoreTeam();

      const updatedUser = await UserProfile.findById(user._id);

      // Should not get a new blue square since hours were met
      expect(updatedUser.infringements.length).toBe(6);
      expect(updatedUser.missedHours).toBe(0);
    });
  });
});
