const moment = require('moment-timezone');
const { getFinalWeekIndex } = require('../finalWeekIndex');

const TZ = 'America/Los_Angeles';
const pt = (s) => moment.tz(s, TZ).toDate();
// Deactivation stores endDate as the end of the chosen day in Pacific time.
const endOfDayPt = (s) => moment.tz(s, TZ).endOf('day').toDate();

describe('getFinalWeekIndex', () => {
  // Tuesday, Sep 22 2026. Tabs: This Week = Sep 20-26, Last Week = Sep 13-19,
  // Week Before Last = Sep 6-12, Three Weeks Ago = Aug 30-Sep 5.
  const now = pt('2026-09-22 12:00');

  describe('maps an end date to the tab of the week it falls in', () => {
    it.each([
      ['This Week', '2026-09-21', 0],
      ['Last Week', '2026-09-16', 1],
      ['Week Before Last', '2026-09-09', 2],
      ['Three Weeks Ago', '2026-09-02', 3],
    ])('%s (%s) -> %i', (_tab, date, expected) => {
      expect(getFinalWeekIndex(endOfDayPt(date), now)).toBe(expected);
    });
  });

  describe('returns null outside the four-week window', () => {
    it('for an end date older than Three Weeks Ago', () => {
      expect(getFinalWeekIndex(endOfDayPt('2026-08-29'), now)).toBeNull();
    });

    it('for a scheduled end date in a future week', () => {
      expect(getFinalWeekIndex(endOfDayPt('2026-10-10'), now)).toBeNull();
    });
  });

  describe('treats week boundaries in Pacific time, not UTC', () => {
    it('puts Saturday 11:59:59 PM PT in the earlier week', () => {
      expect(getFinalWeekIndex(pt('2026-09-19 23:59:59'), now)).toBe(1);
    });

    it('puts Sunday 12:00 AM PT in the later week', () => {
      expect(getFinalWeekIndex(pt('2026-09-20 00:00:00'), now)).toBe(0);
    });

    it('reads a UTC ISO string that is already Sunday in UTC as Saturday PT', () => {
      // 2026-09-20T06:59:59Z is Sep 19, 11:59:59 PM PDT.
      expect(getFinalWeekIndex('2026-09-20T06:59:59.999Z', now)).toBe(1);
    });
  });

  describe('is not thrown off by daylight saving changes', () => {
    it('handles the week DST ends (Nov 1 2026)', () => {
      const afterFallBack = pt('2026-11-03 12:00');
      expect(getFinalWeekIndex(endOfDayPt('2026-10-28'), afterFallBack)).toBe(1);
      expect(getFinalWeekIndex(endOfDayPt('2026-11-01'), afterFallBack)).toBe(0);
    });

    it('handles the week DST starts (Mar 14 2027)', () => {
      const afterSpringForward = pt('2027-03-16 12:00');
      expect(getFinalWeekIndex(endOfDayPt('2027-03-10'), afterSpringForward)).toBe(1);
      expect(getFinalWeekIndex(endOfDayPt('2027-03-14'), afterSpringForward)).toBe(0);
    });
  });

  describe('handles missing or bad input', () => {
    it.each([null, undefined, '', 'not-a-date'])('returns null for %p', (value) => {
      expect(getFinalWeekIndex(value, now)).toBeNull();
    });
  });

  it('accepts both Date objects and ISO strings', () => {
    const date = endOfDayPt('2026-09-16');
    expect(getFinalWeekIndex(date, now)).toBe(1);
    expect(getFinalWeekIndex(date.toISOString(), now)).toBe(1);
  });
});
