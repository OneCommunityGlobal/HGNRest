const { buildReportPeriods, getRunKey, formatReportDate } = require('../periods');

const TZ = 'America/Los_Angeles';
// Monday 2026-10-26 12:00 Pacific; last completed week is Sun 10/18 to Sat 10/24.
const NOW = new Date('2026-10-26T19:00:00Z');

describe('weeklyOrgSummary periods', () => {
  it('builds week-over-week windows for the last completed week', () => {
    const [week] = buildReportPeriods(NOW, TZ);
    expect(week).toMatchObject({
      label: 'Week-over-Week',
      comparison: 'Week Over Week',
      from: '2026-10-18',
      to: '2026-10-24',
      compareFrom: '2026-10-11',
      compareTo: '2026-10-17',
    });
  });

  it('builds month-over-month windows as 4 weeks versus the previous 4 weeks', () => {
    const month = buildReportPeriods(NOW, TZ)[1];
    expect(month).toMatchObject({
      label: 'Month-over-Month',
      from: '2026-09-27',
      to: '2026-10-24',
      compareFrom: '2026-08-30',
      compareTo: '2026-09-26',
    });
  });

  it('builds year-over-year windows as 365 days versus the previous 365', () => {
    const year = buildReportPeriods(NOW, TZ)[2];
    expect(year).toMatchObject({
      label: 'Year-over-Year',
      from: '2025-10-25',
      to: '2026-10-24',
      compareFrom: '2024-10-25',
      compareTo: '2025-10-24',
    });
  });

  it('uses the timezone to decide which week just ended', () => {
    // 2026-10-25 03:00 UTC is still Saturday night in Los Angeles but already Sunday in UTC.
    const instant = new Date('2026-10-25T03:00:00Z');
    expect(buildReportPeriods(instant, TZ)[0].to).toBe('2026-10-17');
    expect(buildReportPeriods(instant, 'UTC')[0].to).toBe('2026-10-24');
  });

  it('gives every run in the same week the same run key', () => {
    const sundayMorning = new Date('2026-10-25T15:00:00Z');
    const fridayEvening = new Date('2026-10-30T23:00:00Z');
    expect(getRunKey(sundayMorning, TZ)).toBe('2026-10-18');
    expect(getRunKey(fridayEvening, TZ)).toBe('2026-10-18');
    expect(getRunKey(new Date('2026-11-01T15:00:00Z'), TZ)).toBe('2026-10-25');
  });

  it('formats the report date in the schedule timezone', () => {
    expect(formatReportDate(NOW, TZ)).toBe('October 26, 2026');
  });
});
