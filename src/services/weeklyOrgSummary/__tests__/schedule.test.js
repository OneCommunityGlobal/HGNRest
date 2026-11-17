const { getScheduledFor, isDue, getNextSend, validateSettings } = require('../schedule');

const settings = {
  enabled: true,
  dayOfWeek: 0,
  hour: 8,
  minute: 0,
  timezone: 'America/Los_Angeles',
};

// Sunday 2026-10-25 08:00 Pacific (PDT, UTC-7) is 15:00 UTC.
const SCHEDULED = new Date('2026-10-25T15:00:00Z');

describe('weeklyOrgSummary schedule', () => {
  it('computes the scheduled instant in the configured timezone', () => {
    expect(getScheduledFor(new Date('2026-10-28T12:00:00Z'), settings)).toEqual(SCHEDULED);
    expect(getScheduledFor(new Date('2026-10-28T12:00:00Z'), { ...settings, timezone: 'UTC' })).toEqual(
      new Date('2026-10-25T08:00:00Z'),
    );
  });

  it('is not due before the scheduled time', () => {
    expect(isDue(new Date('2026-10-25T14:59:00Z'), settings)).toBe(false);
  });

  it('is due from the scheduled time until the grace window closes', () => {
    expect(isDue(SCHEDULED, settings)).toBe(true);
    expect(isDue(new Date('2026-10-26T14:59:00Z'), settings)).toBe(true);
    expect(isDue(new Date('2026-10-26T15:00:00Z'), settings)).toBe(false);
  });

  it('is never due when disabled', () => {
    expect(isDue(SCHEDULED, { ...settings, enabled: false })).toBe(false);
  });

  it('reports this week as next until it has been sent, then next week', () => {
    const early = new Date('2026-10-23T12:00:00Z');
    expect(getNextSend(early, settings, false)).toEqual(SCHEDULED);
    const after = new Date('2026-10-25T16:00:00Z');
    expect(getNextSend(after, settings, true)).toEqual(new Date('2026-11-01T16:00:00Z'));
    expect(getNextSend(after, settings, false)).toEqual(SCHEDULED);
  });

  it('skips to next week once the grace window has passed unsent', () => {
    const late = new Date('2026-10-27T12:00:00Z');
    expect(getNextSend(late, settings, false)).toEqual(new Date('2026-11-01T16:00:00Z'));
  });

  it('validates schedule input', () => {
    expect(validateSettings({ dayOfWeek: 1, hour: 9, minute: 30, timezone: 'Asia/Kolkata' })).toEqual([]);
    expect(validateSettings({ dayOfWeek: 7, hour: 24, minute: 60, timezone: 'Nope/Zone' })).toHaveLength(4);
    expect(validateSettings({ enabled: 'yes' })).toHaveLength(1);
    expect(validateSettings({ alertRecipients: ['a@b.co', 'bad'] })).toHaveLength(1);
  });
});
