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

    it('should assign first blue square when 2 hours missed (8/10)', async () => {
      // 1. Create test user with no existing infringements
      const user = await createUser();
      user.infringements = []; // No existing blue squares
      user.weeklycommittedHours = 10; // 10 hour commitment
      user.role = 'Core Team';
      user.missedHours = 0;
      await user.save();

      // 2. Setup last week's date range (PDT)
      const pdt = moment.tz('America/Los_Angeles');
      const lastWeekStart = pdt.clone().startOf('week').subtract(1, 'week');
      const lastWeekEnd = pdt.clone().endOf('week').subtract(1, 'week');

      // 3. Create time entries totaling 8 hours (2 hours short)
      await TimeEntry.create([
        {
          personId: user._id,
          dateOfWork: lastWeekStart.clone().add(1, 'day').format('YYYY-MM-DD'),
          isTangible: true,
          entryType: 'task',
          totalSeconds: 3 * 3600, // 3 hours
          createdDateTime: new Date(),
          isActive: true,
        },
        {
          personId: user._id,
          dateOfWork: lastWeekStart.clone().add(3, 'days').format('YYYY-MM-DD'),
          isTangible: true,
          entryType: 'task',
          totalSeconds: 5 * 3600, // 5 hours
          createdDateTime: new Date(),
          isActive: true,
        },
      ]);

      // 4. Execute the blue square assignment
      await userHelper.assignBlueSquareForTimeNotMet();
      await userHelper.applyMissedHourForCoreTeam();

      // 5. Verify results
      const updatedUser = await UserProfile.findById(user._id);
      console.log('INFO: User Profile Infringements: ', updatedUser.infringements);

      // Should have exactly 1 new infringement (blue square)
      expect(updatedUser.infringements.length).toBe(1);

      // Should show 2 missed hours (10 committed - 8 worked)
      expect(updatedUser.missedHours).toBe(2);

      // Verify infringement details
      // const newInfringement = updatedUser.infringements[0];
      // expect(newInfringement.date).toBe(moment().format('YYYY-MM-DD'));
      // expect(newInfringement.description).toContain('Missed 2 hours');
      // expect(newInfringement.description).toContain(lastWeekStart.format('YYYY-MM-DD'));
      // expect(newInfringement.description).toContain(lastWeekEnd.format('YYYY-MM-DD'));

      // For Core Team, missed hours should carry forward
      await userHelper.applyMissedHourForCoreTeam();
      const finalUser = await UserProfile.findById(user._id);
      expect(finalUser.missedHours).toBe(2); // Should carry forward the 2 missed hours
    });
  });
  describe('More than 5 Blue Squares ', () => {
    it('should maintain 6 infringements and 0 missed hours when logging exact committed hours', async () => {
      // 6 existing infringements
      const user = await createUser();
      user.infringements = Array(6)
        .fill()
        .map((_, i) => ({
          date: moment()
            .subtract(i + 1, 'weeks')
            .format('YYYY-MM-DD'),
          description: `Infringement ${i + 1}`,
        }));
      user.weeklycommittedHours = 10;
      user.role = 'Core Team';
      user.missedHours = 0;
      await user.save();

      const pdt = moment.tz('America/Los_Angeles');
      const lastWeekStart = pdt.clone().startOf('week').subtract(1, 'week');

      // 10 hours (2 entries of 5 hours)
      await TimeEntry.create([
        {
          personId: user._id,
          dateOfWork: lastWeekStart.clone().add(1, 'day').format('YYYY-MM-DD'),
          isTangible: true,
          entryType: 'task',
          totalSeconds: 5 * 3600,
          createdDateTime: new Date(),
        },
        {
          personId: user._id,
          dateOfWork: lastWeekStart.clone().add(3, 'days').format('YYYY-MM-DD'),
          isTangible: true,
          entryType: 'task',
          totalSeconds: 5 * 3600,
          createdDateTime: new Date(),
        },
      ]);

      // Execute
      await userHelper.assignBlueSquareForTimeNotMet();
      await userHelper.applyMissedHourForCoreTeam();

      // Verify
      const updatedUser = await UserProfile.findById(user._id);
      // did not miss any hours so nothing changes
      expect(updatedUser.infringements.length).toBe(6);
      expect(updatedUser.missedHours).toBe(0);
    });
    it('should only carry forward missed hours with additional hours', async () => {
      //  Create user
      const user = await createUser();
      user.infringements = Array(6)
        .fill()
        .map((_, i) => ({
          date: moment()
            .subtract(i + 1, 'weeks')
            .format('YYYY-MM-DD'),
          description: `Week ${5 - i} infringement`,
        }));
      user.weeklycommittedHours = 10;
      user.role = 'Core Team';
      user.missedHours = 3;
      await user.save();

      const pdt = moment.tz('America/Los_Angeles');
      const week6Start = pdt.clone().startOf('week').subtract(1, 'week');

      await TimeEntry.create([
        {
          personId: user._id,
          dateOfWork: week6Start.clone().add(1, 'day').format('YYYY-MM-DD'),
          isTangible: true,
          entryType: 'task',
          totalSeconds: 5 * 3600,
          createdDateTime: new Date(),
        },
        {
          personId: user._id,
          dateOfWork: week6Start.clone().add(2, 'day').format('YYYY-MM-DD'),
          isTangible: true,
          entryType: 'task',
          totalSeconds: 5 * 3600,
          createdDateTime: new Date(),
        },
      ]);

      // 4. Execute the functions
      await userHelper.assignBlueSquareForTimeNotMet();
      await userHelper.applyMissedHourForCoreTeam();

      // 5. Verify Week 6 results
      const updatedUser = await UserProfile.findById(user._id);

      // Should have 7 infringements (added new one)
      expect(updatedUser.infringements.length).toBe(7);

      // already have 3 missed ours
      // missed 3 last week
      //
      // 2 + 3 = 5 extra hours next week
      // 2 from Blue Square
      // 3 from missed hours

      expect(updatedUser.missedHours).toBe(5);
    });
    it('should only add missed hours (no penalty) for 5th blue square', async () => {
      // 1. Create user with 4 Blue Squares
      const user = await createUser();
      user.infringements = Array(4)
        .fill()
        .map((_, i) => ({
          date: moment()
            .subtract(i + 1, 'weeks')
            .format('YYYY-MM-DD'),
          description: `Week ${4 - i} infringement`,
        }));
      user.weeklycommittedHours = 10;
      user.role = 'Core Team';
      user.missedHours = 0;
      await user.save();

      const pdt = moment.tz('America/Los_Angeles');
      const weekStart = pdt.clone().startOf('week').subtract(1, 'week');
      await TimeEntry.create([
        {
          personId: user._id,
          dateOfWork: weekStart.clone().add(1, 'day').format('YYYY-MM-DD'),
          isTangible: true,
          entryType: 'task',
          totalSeconds: 3 * 3600,
          createdDateTime: new Date(),
        },
        {
          personId: user._id,
          dateOfWork: weekStart.clone().add(3, 'day').format('YYYY-MM-DD'),
          isTangible: true,
          entryType: 'task',
          totalSeconds: 4 * 3600,
          createdDateTime: new Date(),
        },
      ]);

      // 4. Execute the functions
      await userHelper.assignBlueSquareForTimeNotMet();
      await userHelper.applyMissedHourForCoreTeam();

      // 5. Verify results
      const updatedUser = await UserProfile.findById(user._id);

      // Should have exactly 5 infringements (added the 5th)
      expect(updatedUser.infringements.length).toBe(5);

      // Should only carry forward missed hours (no penalty yet)
      // Missed hours: 10 - 7 = 3
      expect(updatedUser.missedHours).toBe(3);
    });
  });
});
