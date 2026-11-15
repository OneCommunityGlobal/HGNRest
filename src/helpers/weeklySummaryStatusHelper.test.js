jest.mock('../models/userProfile', () => ({ find: jest.fn() }));
jest.mock('../utilities/permissions', () => ({ hasPermission: jest.fn() }));

const UserProfile = require('../models/userProfile');
const { hasPermission } = require('../utilities/permissions');
const {
  getWeeklySummaryStatus,
  getWeeklySummaryStatusMap,
  WEEKLY_SUMMARY_STATUS,
} = require('./weeklySummaryStatusHelper');

describe('weeklySummaryStatusHelper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    hasPermission.mockResolvedValue(false);
  });

  describe('getWeeklySummaryStatus', () => {
    // Wednesday, Oct 29 2026, noon Pacific. The week runs Sun Oct 25 – Sat Oct 31.
    const now = new Date('2026-10-29T19:00:00Z');
    const thisWeekDue = new Date('2026-11-01T06:59:59Z'); // Sat Oct 31 23:59:59 PDT
    const lastWeekDue = new Date('2026-10-25T06:59:59Z'); // Sat Oct 24 23:59:59 PDT

    it('is completed when the current week has a summary', () => {
      const profile = { weeklySummaries: [{ dueDate: thisWeekDue, summary: 'Did things' }] };
      expect(getWeeklySummaryStatus(profile, now)).toBe(WEEKLY_SUMMARY_STATUS.COMPLETED);
    });

    it('is incomplete when the current week summary is empty or whitespace', () => {
      const profile = { weeklySummaries: [{ dueDate: thisWeekDue, summary: '   ' }] };
      expect(getWeeklySummaryStatus(profile, now)).toBe(WEEKLY_SUMMARY_STATUS.INCOMPLETE);
    });

    it("does not count last week's summary for the current week", () => {
      const profile = { weeklySummaries: [{ dueDate: lastWeekDue, summary: 'Old summary' }] };
      expect(getWeeklySummaryStatus(profile, now)).toBe(WEEKLY_SUMMARY_STATUS.INCOMPLETE);
    });

    it('is incomplete when the user has no summary records', () => {
      expect(getWeeklySummaryStatus({}, now)).toBe(WEEKLY_SUMMARY_STATUS.INCOMPLETE);
      expect(getWeeklySummaryStatus({ weeklySummaries: [] }, now)).toBe(
        WEEKLY_SUMMARY_STATUS.INCOMPLETE,
      );
    });

    it('is notRequired when the user is exempt from weekly summaries', () => {
      const profile = { weeklySummaryNotReq: true, weeklySummaries: [] };
      expect(getWeeklySummaryStatus(profile, now)).toBe(WEEKLY_SUMMARY_STATUS.NOT_REQUIRED);
    });

    it('returns null when there is no profile', () => {
      expect(getWeeklySummaryStatus(null, now)).toBeNull();
    });
  });

  describe('getWeeklySummaryStatusMap', () => {
    const now = new Date('2026-10-29T19:00:00Z');
    const thisWeekDue = new Date('2026-11-01T06:59:59Z');
    const idA = '64b000000000000000000001';
    const idB = '64b000000000000000000002';
    const requestor = { requestorId: 'admin', role: 'Administrator' };

    it('returns null and skips the query when the requestor lacks dashboard access', async () => {
      hasPermission.mockResolvedValue(false);
      expect(await getWeeklySummaryStatusMap(requestor, [idA], now)).toBeNull();
      expect(hasPermission).toHaveBeenCalledWith(requestor, 'accessHgnSkillsDashboard');
      expect(UserProfile.find).not.toHaveBeenCalled();
    });

    it('maps each user id to its own status with a single query', async () => {
      hasPermission.mockResolvedValue(true);
      UserProfile.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { _id: idA, weeklySummaries: [{ dueDate: thisWeekDue, summary: 'done' }] },
          { _id: idB, weeklySummaries: [] },
        ]),
      });

      const result = await getWeeklySummaryStatusMap(requestor, [idA, idB, idA, null], now);

      expect(result).toEqual({ [idA]: 'completed', [idB]: 'incomplete' });
      expect(UserProfile.find).toHaveBeenCalledTimes(1);
      expect(UserProfile.find).toHaveBeenCalledWith(
        { _id: { $in: [idA, idB] } },
        { weeklySummaryNotReq: 1, weeklySummaries: { $slice: 1 } },
      );
    });

    it('ignores ids that are not valid ObjectIds', async () => {
      hasPermission.mockResolvedValue(true);
      expect(await getWeeklySummaryStatusMap(requestor, ['not-an-id'], now)).toEqual({});
      expect(UserProfile.find).not.toHaveBeenCalled();
    });
  });
});
