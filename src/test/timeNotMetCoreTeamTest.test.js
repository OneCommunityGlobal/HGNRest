const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const moment = require('moment-timezone');

// Import dependencies
const userHelper = require('../helpers/userHelper')();
const dashboardHelper = require('../helpers/dashboardhelper')();
const emailSender = require('../utilities/emailSender');
const logger = require('../startup/logger');
const createUser = require('./db/createUser');
const UserProfile = require('../models/userProfile');
const TimeEntry = require('../models/timeentry');

// Mock dependencies
jest.mock('../helpers/dashboardHelper');
jest.mock('../utilities/emailSender');
jest.mock('../startup/logger');

// Helper function to generate random dates in last week (PDT)
function getRandomDateInLastWeekPDT() {
  const pdtStartOfLastWeek = moment().tz('America/Los_Angeles').startOf('week').subtract(1, 'week');
  const pdtEndOfLastWeek = moment().tz('America/Los_Angeles').endOf('week').subtract(1, 'week');
  const randomTime =
    pdtStartOfLastWeek.valueOf() +
    Math.random() * (pdtEndOfLastWeek.valueOf() - pdtStartOfLastWeek.valueOf());
  return new Date(randomTime);
}

describe('Time Not Met Core Team Test', () => {
  let mongoServer;
  let userProfileModel;
  let timeEntryModel;

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
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  describe('Less than 5 Blue Squares', () => {
    it('should not assign blue square if no missed hours and no entry exceeds 5 hrs', async () => {
      // Create test user with createUser function
      const user = await createUser();
      user.weeklycommittedHours = 10;
      user.role = 'Core Team';
      user.infringements = []; // Empty array for no blue squares
      user.missedHours = 0; // Also include this since it's used in the logic
      await user.save();

      // Create time entries totaling exactly committed hours
      await TimeEntry.create([
        {
          personId: user._id,
          dateOfWork: getRandomDateInLastWeekPDT(),
          isTangible: true,
          entryType: 'task',
          totalSeconds: 3 * 3600,
        },
        {
          personId: user._id,
          dateOfWork: getRandomDateInLastWeekPDT(),
          isTangible: true,
          entryType: 'task',
          totalSeconds: 4 * 3600,
        },
        {
          personId: user._id,
          dateOfWork: getRandomDateInLastWeekPDT(),
          isTangible: true,
          entryType: 'task',
          totalSeconds: 3 * 3600,
        },
      ]);

      // Execute the functions
      await userHelper.assignBlueSquareForTimeNotMet();
      await userHelper.applyMissedHourForCoreTeam();

      // Verify results
      const updatedUser = await UserProfile.findById(user._id);
      expect(updatedUser.infringements.length).toBe(0);
    });

    it.todo('should only carry forward missed hours without additional hours');
  });
  describe('More than 5 Blue Squares ', () => {
    it.todo('should not assign blue square if no missed hours');
    it.todo('should only carry forward missed hours with additional hours');
    it.todo(
      'should not assign assign extra hours(only missed hours are added) if this is the 5th blue square',
    );
  });
});
