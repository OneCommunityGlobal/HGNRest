const mongoose = require('mongoose');
const moment = require('moment-timezone');

const emailSender = jest.fn().mockResolvedValue(undefined);

jest.mock('../../startup/logger', () => ({
  logInfo: jest.fn(),
  logException: jest.fn(),
}));

jest.mock('../../utilities/emailSender', () => emailSender);

jest.mock('../../services/notificationService', () => ({
  createNotification: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../utilities/nodeCache', () => () => ({
  hasCache: jest.fn().mockReturnValue(false),
  removeCache: jest.fn(),
}));

jest.mock('../../models/timeOffRequest', () => ({
  find: jest.fn().mockResolvedValue([]),
  deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
}));

jest.mock('../../models/BlueSquareEmailAssignment', () => ({
  find: jest.fn(),
}));

jest.mock('../../models/timeentry', () => ({
  find: jest.fn().mockResolvedValue([]),
}));

jest.mock('../reporthelper', () => jest.fn(() => ({})));

const laborthisweek = jest.fn();
const laborThisWeekByCategory = jest.fn().mockResolvedValue([]);

jest.mock('../dashboardhelper', () =>
  jest.fn(() => ({
    laborthisweek,
    laborThisWeekByCategory,
  })),
);

jest.mock('../../models/userProfile', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  aggregate: jest.fn(),
  bulkWrite: jest.fn().mockResolvedValue({}),
  updateOne: jest.fn().mockResolvedValue({}),
  updateMany: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
  findByIdAndUpdate: jest.fn().mockResolvedValue({}),
  findOneAndUpdate: jest.fn().mockResolvedValue(null),
}));

const userProfile = require('../../models/userProfile');
const timeEntries = require('../../models/timeentry');
const timeOffRequest = require('../../models/timeOffRequest');
const BlueSquareEmailAssignment = require('../../models/BlueSquareEmailAssignment');
const userHelperFactory = require('../userHelper');
const {
  buildCoreTeamMissedHoursAggregation,
} = require('../coreTeamMissedHoursAggregation');

const {
  applyMissedHourForCoreTeam,
  assignBlueSquareForTimeNotMet,
  resendBlueSquareEmailsOnlyForLastWeek,
  getInfringementEmailBody,
} = userHelperFactory();

describe('Core Team carryover helper coverage', () => {
  const userId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();
    laborthisweek.mockResolvedValue([{ timeSpent_hrs: 3 }]);
    laborThisWeekByCategory.mockResolvedValue([]);
    BlueSquareEmailAssignment.find.mockReturnValue({
      populate: jest.fn(() => ({
        exec: jest.fn().mockResolvedValue([]),
      })),
    });
    userProfile.findByIdAndUpdate.mockResolvedValue({
      _id: userId,
      firstName: 'Core',
      lastName: 'Team',
      email: 'coreteam@test.com',
      role: 'Core Team',
      infringements: [{ date: '2025-06-01', description: 'prior infringement' }],
      jobTitle: ['Engineer'],
      weeklySummaryOption: 'Required',
      weeklySummaryNotReq: false,
    });
  });

  describe('applyMissedHourForCoreTeam', () => {
    it('bulk-writes missed hours for Core Team aggregation results', async () => {
      userProfile.aggregate.mockResolvedValue([
        { _id: userId, missedHours: 3 },
        { _id: new mongoose.Types.ObjectId(), missedHours: 0 },
      ]);

      await applyMissedHourForCoreTeam();

      expect(userProfile.aggregate).toHaveBeenCalled();
      expect(userProfile.bulkWrite).toHaveBeenCalledWith([
        {
          updateOne: {
            filter: { _id: userId },
            update: { $set: { missedHours: 3 } },
          },
        },
        expect.objectContaining({
          updateOne: expect.objectContaining({
            update: { $set: { missedHours: 0 } },
          }),
        }),
      ]);
    });

    it('skips bulkWrite when aggregation returns no users', async () => {
      userProfile.aggregate.mockResolvedValue([]);

      await applyMissedHourForCoreTeam();

      expect(userProfile.bulkWrite).not.toHaveBeenCalled();
    });

    it('uses the extracted Core Team aggregation builder', async () => {
      userProfile.aggregate.mockResolvedValue([]);

      await applyMissedHourForCoreTeam();

      expect(userProfile.aggregate).toHaveBeenCalledWith(
        buildCoreTeamMissedHoursAggregation(
          expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        ),
      );
    });

    it('logs exception when aggregation fails', async () => {
      const logger = require('../../startup/logger');
      userProfile.aggregate.mockRejectedValue(new Error('aggregate failed'));

      await applyMissedHourForCoreTeam();

      expect(logger.logException).toHaveBeenCalled();
    });
  });

  describe('assignBlueSquareForTimeNotMet', () => {
    const buildCoreTeamUser = (infringementCount = 0) => {
      const infringements = Array.from({ length: infringementCount }, (_, index) => ({
        date: moment().subtract(index + 1, 'months').format('YYYY-MM-DD'),
        description: `infringement ${index + 1}`,
      }));

      return {
        _id: userId,
        role: 'Core Team',
        weeklycommittedHours: 10,
        missedHours: 2,
        startDate: '2020-01-01',
        totalTangibleHrs: 100,
        totalIntangibleHrs: 0,
        infringements,
        weeklySummaries: [{ summary: 'Weekly summary submitted', dueDate: new Date() }],
      };
    };

    it('assigns blue square and queues Core Team email with penalty breakdown', async () => {
      const coreTeamUser = buildCoreTeamUser(5);
      userProfile.find.mockResolvedValueOnce([coreTeamUser]).mockResolvedValueOnce([]);
      userProfile.findByIdAndUpdate.mockResolvedValue({
        _id: userId,
        firstName: 'Core',
        lastName: 'Team',
        email: 'coreteam@test.com',
        role: 'Core Team',
        infringements: Array.from({ length: 6 }, (_, index) => ({
          date: moment().subtract(index, 'weeks').format('YYYY-MM-DD'),
          description: 'auto assigned',
        })),
        jobTitle: ['Engineer'],
      });

      await assignBlueSquareForTimeNotMet();

      expect(userProfile.find).toHaveBeenCalled();
      expect(userProfile.findByIdAndUpdate).toHaveBeenCalled();
      expect(emailSender).toHaveBeenCalled();
      expect(emailSender.mock.calls[0][1]).toBe('New Infringement Assigned');
      const emailBody = emailSender.mock.calls[0][2];
      expect(emailBody).toContain('Please complete ALL owed time this week');
      expect(emailBody).not.toContain('-3 hour');
    });

    it('does not queue email when Core Team user is new and only missed summary', async () => {
      laborthisweek.mockResolvedValue([{ timeSpent_hrs: 10 }]);
      const newUser = {
        ...buildCoreTeamUser(0),
        startDate: moment().format('YYYY-MM-DD'),
        totalTangibleHrs: 0,
        totalIntangibleHrs: 0,
        weeklySummaries: [{ summary: '', dueDate: new Date() }],
      };
      userProfile.find.mockResolvedValueOnce([newUser]).mockResolvedValueOnce([]);

      await assignBlueSquareForTimeNotMet();

      expect(emailSender).not.toHaveBeenCalled();
    });

    it('assigns volunteer infringement using non-Core Team description', async () => {
      const volunteerUser = {
        _id: userId,
        role: 'Volunteer',
        weeklycommittedHours: 10,
        missedHours: 0,
        startDate: '2020-01-01',
        totalTangibleHrs: 50,
        totalIntangibleHrs: 0,
        infringements: [],
        weeklySummaries: [{ summary: 'Submitted summary', dueDate: new Date() }],
      };

      laborthisweek.mockResolvedValue([{ timeSpent_hrs: 4 }]);
      userProfile.find.mockResolvedValueOnce([volunteerUser]).mockResolvedValueOnce([]);
      userProfile.findByIdAndUpdate.mockResolvedValue({
        _id: userId,
        firstName: 'Vol',
        lastName: 'User',
        email: 'vol@test.com',
        role: 'Volunteer',
        infringements: [{ date: '2025-01-01', description: 'vol infringement' }],
        jobTitle: ['Volunteer'],
      });

      await assignBlueSquareForTimeNotMet();

      expect(emailSender).toHaveBeenCalled();
      const emailBody = emailSender.mock.calls[0][2];
      expect(emailBody).toContain('not meeting weekly volunteer time commitment');
      expect(emailBody).not.toContain('hours owed for last week');
    });

    it('assigns volunteer infringement when both hours and summary are missed', async () => {
      const volunteerUser = {
        _id: userId,
        role: 'Volunteer',
        weeklycommittedHours: 10,
        missedHours: 0,
        startDate: '2020-01-01',
        totalTangibleHrs: 50,
        totalIntangibleHrs: 0,
        infringements: [],
        weeklySummaries: [{ summary: '', dueDate: new Date() }],
      };

      laborthisweek.mockResolvedValue([{ timeSpent_hrs: 4 }]);
      userProfile.find.mockResolvedValueOnce([volunteerUser]).mockResolvedValueOnce([]);
      userProfile.findByIdAndUpdate.mockResolvedValue({
        _id: userId,
        firstName: 'Vol',
        lastName: 'User',
        email: 'vol@test.com',
        role: 'Volunteer',
        infringements: [{ date: '2025-01-01', description: 'vol infringement' }],
        jobTitle: ['Volunteer'],
      });

      await assignBlueSquareForTimeNotMet();

      expect(emailSender).toHaveBeenCalled();
      const emailBody = emailSender.mock.calls[0][2];
      expect(emailBody).toContain(
        'not meeting weekly volunteer time commitment as well as not submitting a weekly summary',
      );
    });

    it('updates tangible hours by category when category data exists', async () => {
      laborThisWeekByCategory.mockResolvedValue([{ _id: 'Development', timeSpent_hrs: 2 }]);
      userProfile.findOneAndUpdate.mockResolvedValueOnce(null).mockResolvedValueOnce({ _id: userId });

      const coreTeamUser = buildCoreTeamUser(1);
      userProfile.find.mockResolvedValueOnce([coreTeamUser]).mockResolvedValueOnce([]);
      userProfile.findByIdAndUpdate.mockResolvedValue({
        _id: userId,
        firstName: 'Core',
        lastName: 'Team',
        email: 'coreteam@test.com',
        role: 'Core Team',
        infringements: [{ date: '2025-01-01', description: 'assigned' }],
        jobTitle: ['Engineer'],
      });

      await assignBlueSquareForTimeNotMet();

      expect(userProfile.findOneAndUpdate).toHaveBeenCalled();
    });

    it('assigns summary-only infringement when hours are met but summary is missing', async () => {
      const coreTeamUser = {
        ...buildCoreTeamUser(2),
        weeklySummaries: [{ summary: '', dueDate: new Date() }],
      };
      laborthisweek.mockResolvedValue([{ timeSpent_hrs: 20 }]);
      userProfile.find.mockResolvedValueOnce([coreTeamUser]).mockResolvedValueOnce([]);
      userProfile.findByIdAndUpdate.mockResolvedValue({
        _id: userId,
        firstName: 'Core',
        lastName: 'Team',
        email: 'coreteam@test.com',
        role: 'Core Team',
        infringements: [{ date: '2025-01-01', description: 'summary miss' }],
        jobTitle: ['Engineer'],
      });

      await assignBlueSquareForTimeNotMet();

      expect(emailSender).toHaveBeenCalled();
      const emailBody = emailSender.mock.calls[0][2];
      expect(emailBody).toContain('not submitting a weekly summary');
    });

    it('skips infringement assignment when an approved time-off request covers the week', async () => {
      const coreTeamUser = buildCoreTeamUser(1);
      userProfile.find.mockResolvedValueOnce([coreTeamUser]).mockResolvedValueOnce([]);
      timeOffRequest.find.mockResolvedValueOnce([
        {
          startingDate: moment().subtract(2, 'weeks').toDate(),
          endingDate: moment().add(1, 'week').toDate(),
          reason: 'Approved vacation',
          createdAt: new Date(),
        },
      ]);

      await assignBlueSquareForTimeNotMet();

      expect(emailSender).not.toHaveBeenCalled();
    });

    it('includes active BCC recipients when blue square email assignments exist', async () => {
      BlueSquareEmailAssignment.find.mockReturnValue({
        populate: jest.fn(() => ({
          exec: jest.fn().mockResolvedValue([
            { email: 'bcc@test.com', assignedTo: { isActive: true } },
            { email: 'inactive@test.com', assignedTo: { isActive: false } },
          ]),
        })),
      });

      const coreTeamUser = buildCoreTeamUser(5);
      userProfile.find.mockResolvedValueOnce([coreTeamUser]).mockResolvedValueOnce([]);
      userProfile.findOne.mockResolvedValue({ _id: new mongoose.Types.ObjectId() });
      userProfile.findByIdAndUpdate.mockResolvedValue({
        _id: userId,
        firstName: 'Core',
        lastName: 'Team',
        email: 'coreteam@test.com',
        role: 'Core Team',
        infringements: [{ date: '2025-01-01', description: 'assigned' }],
        jobTitle: ['Engineer'],
      });

      await assignBlueSquareForTimeNotMet();

      expect(emailSender).toHaveBeenCalled();
      expect(emailSender.mock.calls[0][6]).toEqual(['bcc@test.com']);
    });

    it('processes inactive users for weekly summary rollover', async () => {
      userProfile.find
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ _id: new mongoose.Types.ObjectId() }]);

      await assignBlueSquareForTimeNotMet();

      expect(userProfile.find).toHaveBeenCalledTimes(2);
      expect(userProfile.findByIdAndUpdate).toHaveBeenCalled();
    });
  });

  describe('resendBlueSquareEmailsOnlyForLastWeek', () => {
    it('resends Core Team email using base commitment and penalty hours', async () => {
      const lastWeek = moment.tz('America/Los_Angeles').startOf('week').subtract(1, 'week');
      const infringementDate = lastWeek.clone().add(2, 'days').format('YYYY-MM-DD');
      const yearInfringements = Array.from({ length: 6 }, (_, index) => ({
        date: moment().subtract(index, 'months').format('YYYY-MM-DD'),
        description: `System auto-assigned infringement for not meeting weekly volunteer time commitment. logged ${index} hours`,
      }));
      yearInfringements[0].date = infringementDate;

      const coreTeamUser = {
        _id: userId,
        firstName: 'Bear',
        lastName: 'Test',
        email: 'bear@test.com',
        role: 'Core Team',
        weeklycommittedHours: 5,
        missedHours: 0,
        startDate: '2020-01-01',
        infringements: yearInfringements,
        jobTitle: ['Volunteer'],
      };

      userProfile.find.mockResolvedValue([coreTeamUser]);
      timeEntries.find.mockResolvedValue([{ totalSeconds: 0 }]);

      await resendBlueSquareEmailsOnlyForLastWeek();

      expect(emailSender).toHaveBeenCalledWith(
        'bear@test.com',
        '[RESEND] Blue Square Notification',
        expect.stringContaining('Please complete ALL owed time this week'),
        null,
        expect.any(Array),
        'bear@test.com',
        expect.any(Array),
      );
      const resendBody = emailSender.mock.calls[0][2];
      expect(resendBody).not.toContain('-3 hour');
    });

    it('uses non-Core Team resend path when time remaining is zero', async () => {
      const lastWeek = moment.tz('America/Los_Angeles').startOf('week').subtract(1, 'week');
      const infringementDate = lastWeek.clone().add(1, 'day').format('YYYY-MM-DD');
      const volunteerUser = {
        _id: userId,
        firstName: 'Vol',
        lastName: 'User',
        email: 'vol@test.com',
        role: 'Volunteer',
        weeklycommittedHours: 10,
        missedHours: 0,
        startDate: '2020-01-01',
        infringements: [{ date: infringementDate, description: 'missed summary only' }],
        jobTitle: ['Volunteer'],
      };

      userProfile.find.mockResolvedValue([volunteerUser]);
      timeEntries.find.mockResolvedValue([{ totalSeconds: 36000 }]);

      await resendBlueSquareEmailsOnlyForLastWeek();

      expect(emailSender).toHaveBeenCalled();
      const resendBody = emailSender.mock.calls[0][2];
      expect(resendBody).toContain('This is your');
      expect(resendBody).not.toContain('Please complete ALL owed time this week');
    });

    it('logs resend failures without throwing', async () => {
      const logger = require('../../startup/logger');
      userProfile.find.mockRejectedValue(new Error('resend failed'));

      await expect(resendBlueSquareEmailsOnlyForLastWeek()).resolves.toBeUndefined();

      expect(logger.logException).toHaveBeenCalled();
    });
  });

  describe('getInfringementEmailBody penalty edge cases', () => {
    it('hides penalty breakdown when coreTeamExtraHour is zero', () => {
      const body = getInfringementEmailBody(
        'Core',
        'Team',
        { date: '2026-01-01', description: 'logged 3 hours' },
        2,
        5,
        0,
        undefined,
        {
          startDate: '1-1-2020',
          role: 'Core Team',
          userTitle: 'Volunteer',
          historyInfringements: 'none',
        },
        5,
      );

      expect(body).toContain('Please complete ALL owed time this week (10 hours)');
      expect(body).not.toContain('hour(s) added to your requirement');
    });

    it('includes penalty breakdown when coreTeamExtraHour is positive', () => {
      const body = getInfringementEmailBody(
        'Core',
        'Team',
        { date: '2026-01-01', description: 'logged 2 hours' },
        6,
        4,
        1,
        undefined,
        {
          startDate: '1-1-2020',
          role: 'Core Team',
          userTitle: 'Volunteer',
          historyInfringements: 'none',
        },
        10,
      );

      expect(body).toContain('1 hour(s) added to your requirement this week');
      expect(body).toContain('Please complete ALL owed time this week (15 hours)');
    });

    it('builds combined Core Team description when both hours and summary are missed', () => {
      const body = getInfringementEmailBody(
        'Core',
        'Team',
        {
          date: '2026-01-01',
          description:
            'System auto-assigned infringement for two reasons: not meeting weekly volunteer time commitment as well as not submitting a weekly summary. You logged 2.00 hours.',
        },
        6,
        3,
        1,
        undefined,
        {
          startDate: '1-1-2020',
          role: 'Core Team',
          userTitle: 'Volunteer',
          historyInfringements: 'none',
        },
        10,
      );

      expect(body).toContain(
        'not meeting weekly volunteer time commitment as well as not submitting a weekly summary',
      );
      expect(body).toContain('1 hour(s) added to your requirement this week');
    });
  });
});
