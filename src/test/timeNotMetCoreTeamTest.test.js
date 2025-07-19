const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const moment = require('moment-timezone');

// Import dependencies and the module to test
const userHelper = require('../helpers/userHelper')();
const userProfile = require('../models/userProfile');
const dashboardHelper = require('../helpers/dashboardhelper')();
const emailSender = require('../utilities/emailSender');
const logger = require('../startup/logger');
const createUser = require('./db/createUser');

// Mock
jest.mock('../helpers/dashboardHelper');
jest.mock('../utilities/emailSender');
jest.mock('../startup/logger');

describe('Time Not Met Core Team Test', () => {
  let mongoServer;
  let User;
  let TimeEntry;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    // Only define schemas we actually need
    const userSchema = new mongoose.Schema({
      _id: String,
      weeklycommittedHours: Number,
      blueSquares: { type: Number, default: 0 }, // Track count here
    });

    const timeEntrySchema = new mongoose.Schema({
      personId: String,
      dateOfWork: Date,
      isTangible: Boolean,
      entryType: String,
      totalSeconds: Number,
    });

    User = mongoose.model('User', userSchema);
    TimeEntry = mongoose.model('TimeEntry', timeEntrySchema);
  });
  beforeEach(async () => {
    await User.deleteMany({});
    await TimeEntry.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  describe('Less than 5 Blue Squares ', () => {
    it('should not assign blue square if no missed hours and no entry exceeds 5 hrs', async () => {
      const user = await User.create({
        _id: 'user1',
        name: 'Test User',
        weeklycommittedHours: 10,
        blueSquares: 0,
        role: 'Core Team',
      });

      await TimeEntry.create([
        {
          personId: 'user1',
          dateOfWork: new Date('2023-01-02'),
          isTangible: true,
          entryType: 'task',
          totalSeconds: 3 * 3600, // 3 hours
        },
        {
          personId: 'user1',
          dateOfWork: new Date('2023-01-03'),
          isTangible: true,
          entryType: 'task',
          totalSeconds: 4 * 3600, // 4 hours
        },
        {
          personId: 'user1',
          dateOfWork: new Date('2023-01-04'),
          isTangible: true,
          entryType: 'task',
          totalSeconds: 3 * 3600, // 3 hours
        },
      ]); // Total: 3 + 4 + 3 = 10 hours

      // Execute the function
      await userHelper.assignBlueSquareForTimeNotMet();
      await userHelper.applyMissedHourForCoreTeam();

      const updatedUser = await User.findById('user1');
      expect(updatedUser.blueSquares).toBe(0);
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
