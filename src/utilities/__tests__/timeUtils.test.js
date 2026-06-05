const moment = require('moment-timezone');
const {
  formatDateAndTime,
  formatDate,
  formattedAmPmTime,
  formatCreatedDate,
  DAY_OF_WEEK,
  getDayOfWeekStringFromUTC,
} = require('../timeUtils');

describe('timeUtils helpers', () => {
  const julyFourthLa = moment.tz('2025-07-04 10:15:20', 'America/Los_Angeles').toDate();

  it('formats date and time with month/day/year and lowercase meridiem', () => {
    expect(formatDateAndTime(julyFourthLa)).toBe('Jul-04-25, 10:15:20 am');
  });

  it('formats date in Pacific time', () => {
    expect(formatDate(julyFourthLa)).toBe('Jul-04-25');
  });

  it('formats time in AM/PM format', () => {
    expect(formattedAmPmTime(julyFourthLa)).toBe('10:15:20 AM');
  });

  it('formats created date as MM/DD', () => {
    expect(formatCreatedDate(julyFourthLa)).toBe('07/04');
  });

  it('maps UTC timestamp to correct weekday index', () => {
    const sundayNoonUTC = '2025-07-06T12:00:00Z';
    const dayIndex = getDayOfWeekStringFromUTC(sundayNoonUTC);
    expect(dayIndex).toBe(0);
    expect(DAY_OF_WEEK[dayIndex]).toBe('Sunday');
  });

  it('exposes a full week constant starting with Sunday', () => {
    expect(DAY_OF_WEEK).toEqual([
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ]);
  });
});
