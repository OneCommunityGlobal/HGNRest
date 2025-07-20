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
    it('should not assign blue square if no missed hours', async () => {
      // 1. Create test user
      const user = await createUser();
      user.weeklycommittedHours = 10;
      user.role = 'Core Team';
      await user.save();

      // 2. Get exact PDT date range (as strings to match schema)
      const pdt = moment.tz('America/Los_Angeles');
      const queryStart = pdt.clone().startOf('week').subtract(1, 'week');
      const queryEnd = pdt.clone().endOf('week').subtract(1, 'week');

      // Format dates exactly as stored in the schema
      const formatDate = (date) => moment(date).format('YYYY-MM-DD');

      // 3. Create test entries with properly formatted string dates
      await TimeEntry.create([
        {
          personId: user._id,
          dateOfWork: formatDate(queryStart.clone().add(1, 'day')),
          isTangible: true,
          entryType: 'task',
          totalSeconds: 4 * 3600,
          createdDateTime: new Date(),
          isActive: true,
        },
        {
          personId: user._id,
          dateOfWork: formatDate(queryStart.clone().add(3, 'days')), // Thursday
          isTangible: true,
          entryType: 'task',
          totalSeconds: 4 * 3600,
          createdDateTime: new Date(),
          isActive: true,
        },
        {
          personId: user._id,
          dateOfWork: formatDate(queryStart.clone().add(5, 'days')), // Saturday
          isTangible: true,
          entryType: 'task',
          totalSeconds: 2 * 3600,
          createdDateTime: new Date(),
          isActive: true,
        },
      ]);

      // 4. Final assertions
      await userHelper.assignBlueSquareForTimeNotMet();
      await userHelper.applyMissedHourForCoreTeam();
      const updatedUser = await UserProfile.findById(user._id);
      expect(updatedUser.infringements.length).toBe(0);
      expect(updatedUser.missedHours).toBe(0);
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
