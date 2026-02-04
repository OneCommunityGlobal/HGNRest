const userHelperFactory = require('../userHelper');

const { getInfringementEmailBody } = userHelperFactory();

describe('getInfringementEmailBody', () => {
  const baseAdministrativeContent = {
    startDate: '1-1-2023',
    role: 'Core Team',
    userTitle: 'Volunteer',
    historyInfringements: 'History snapshot',
  };

  it('returns default messaging when timeRemaining is undefined', () => {
    const infringement = {
      date: '2025-01-05',
      description: 'Should not be used because the time off body is provided',
    };

    const result = getInfringementEmailBody(
      'Jane',
      'Doe',
      infringement,
      3,
      undefined,
      null,
      '<span>Approved time off</span>',
      baseAdministrativeContent,
    );

    expect(result).toContain('This action usually includes removal from our team though');
    expect(result).toContain('This is your <b>3rd</b> blue square of 5.');
    expect(result).toContain('<span>Approved time off</span>');
  });

  it('highlights critical phrases and calculates owed hours when time remaining exists', () => {
    const infringement = {
      date: '2025-02-09',
      description:
        'System auto-assigned infringement for two reasons: not meeting weekly volunteer time commitment as well as not submitting a weekly summary. In the week starting Sunday details. You logged 4 hours.',
    };

    const result = getInfringementEmailBody(
      'John',
      'Smith',
      infringement,
      6,
      4,
      1,
      undefined,
      baseAdministrativeContent,
      10,
    );

    expect(result).toContain(
      '<p><b>Total Infringements:</b> This is your <b>6th</b> blue square of 5 and that means you have 1 hour(s) added',
    );
    expect(result).toContain(
      '<b>not meeting weekly volunteer time commitment as well as not submitting a weekly summary</b>',
    );
    expect(result).toContain('logged <b>4 hours</b>');
    expect(result).toContain('Please complete ALL owed time this week (15 hours)');
  });

  it('wraps plain descriptions in bold tags when no keywords match', () => {
    const infringement = {
      date: '2025-03-01',
      description: 'Missed posting weekly update',
    };

    const result = getInfringementEmailBody(
      'Alex',
      'Lee',
      infringement,
      2,
      1,
      0,
      undefined,
      baseAdministrativeContent,
      5,
    );

    expect(result).toContain('<b>Missed posting weekly update<b>');
  });

  it('formats editing infringement details to emphasize the edit count', () => {
    const infringement = {
      date: '2025-04-07',
      description:
        'System auto-assigned infringement for editing your time entries <3> times. Additional supporting details.',
    };

    const result = getInfringementEmailBody(
      'Evan',
      'Taylor',
      infringement,
      6,
      2,
      0,
      undefined,
      baseAdministrativeContent,
      8,
    );

    expect(result).toContain('time entries <b>3 times</b>');
  });
});
