const userProfile = require('../models/userProfile');
const timeentry = require('../models/timeentry');
const dashboardhelper = require('./dashboardhelper');

// Regression coverage for a bug where several hours-calculation functions in
// this file excluded entryType 'person' time entries (via $not/$nin, or by
// omitting it from an $in allow-list), even though 'person' represents
// legitimate individual task hours. This undercounted org totals, per-user
// leaderboard hours, and weekly labor stats. See also overviewReportHelper.js
// getTotalHoursWorked, which had the identical bug.

describe('dashboardhelper entryType filtering', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getOrgData', () => {
    it("includes 'person' entryType entries as valid hours, not excluded via $not", async () => {
      let capturedCondition;
      jest.spyOn(userProfile, 'aggregate').mockImplementation(async (pipeline) => {
        capturedCondition = pipeline[2].$project.timeEntryData.$filter.cond.$and;
        return [];
      });

      const { getOrgData } = dashboardhelper();
      await getOrgData();

      const entryTypeCondition = capturedCondition[2];
      expect(entryTypeCondition.$not).toBeUndefined();
      expect(entryTypeCondition.$in).toBeDefined();
      expect(entryTypeCondition.$in[1]).toEqual(expect.arrayContaining(['default', 'person']));
    });
  });

  describe('getUserLaborData', () => {
    it("includes 'person' entryType entries in its time entry query", async () => {
      let capturedQuery;
      jest.spyOn(userProfile, 'findById').mockResolvedValue({ role: 'Volunteer' });
      jest.spyOn(timeentry, 'find').mockImplementation(async (query) => {
        capturedQuery = query;
        return [];
      });

      const { getUserLaborData } = dashboardhelper();
      await getUserLaborData('some-user-id');

      expect(capturedQuery.entryType.$in).toEqual(expect.arrayContaining(['default', 'person']));
    });
  });

  describe('laborthisweek', () => {
    it("includes 'person' entryType entries as valid hours, not excluded via $not", async () => {
      let capturedCondition;
      jest.spyOn(userProfile, 'aggregate').mockImplementation(async (pipeline) => {
        capturedCondition = pipeline[3].$project.timeEntryData.$filter.cond.$and;
        return [];
      });

      const { laborthisweek } = dashboardhelper();
      await laborthisweek('some-user-id', '2026-07-19', '2026-07-25');

      const entryTypeCondition = capturedCondition[3];
      expect(entryTypeCondition.$not).toBeUndefined();
      expect(entryTypeCondition.$in).toBeDefined();
      expect(entryTypeCondition.$in[1]).toEqual(expect.arrayContaining(['default', 'person']));
    });
  });

  describe('laborThisWeekByCategory', () => {
    it("includes 'person' entryType entries as valid hours, not excluded via $not", async () => {
      let capturedCondition;
      jest.spyOn(userProfile, 'aggregate').mockImplementation(async (pipeline) => {
        capturedCondition = pipeline[3].$project.timeEntryData.$filter.cond.$and;
        return [];
      });

      const { laborThisWeekByCategory } = dashboardhelper();
      await laborThisWeekByCategory('some-user-id', '2026-07-19', '2026-07-25');

      const entryTypeCondition = capturedCondition[3];
      expect(entryTypeCondition.$not).toBeUndefined();
      expect(entryTypeCondition.$in).toBeDefined();
      expect(entryTypeCondition.$in[1]).toEqual(expect.arrayContaining(['default', 'person']));
    });
  });
});
