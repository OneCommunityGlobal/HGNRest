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
    expect(result).not.toContain('-3 hour');
    expect(result).toContain(
      '<b>not meeting weekly volunteer time commitment as well as not submitting a weekly summary</b>',
    );
    expect(result).toContain('logged <b>4 hours</b>');
    expect(result).toContain('Please complete ALL owed time this week (15 hours)');
  });

  it('does not show negative penalty hours for 2nd blue square (Bear email scenario)', () => {
    const infringement = {
      date: '2026-08-01',
      description:
        'System auto-assigned infringement for not meeting weekly volunteer time commitment. In the week starting Sunday 7-26-2026 and ending Saturday 8-1-2026, you logged 0.00 hours against a committed effort of 5 hours + 0 hours owed for last week + 0 hours owed for this being your 2nd blue square. So you should have completed 5 hours and you completed 0.00 hours.',
    };

    const result = getInfringementEmailBody(
      'Bear',
      'Test',
      infringement,
      2,
      5,
      0,
      undefined,
      baseAdministrativeContent,
      5,
    );

    expect(result).not.toContain('-3 hour');
    expect(result).not.toContain('-3 hours');
    expect(result).toContain('Please complete ALL owed time this week (10 hours)');
    expect(result).toContain('5 hours commitment + 5 hours owed for last week = 10 hours required');
  });

  it('calculates owed hours for under 5 blue squares without penalty (Tatyana scenario)', () => {
    const infringement = {
      date: '2026-08-01',
      description: 'logged 3 hours against 5 hours commitment',
    };

    const result = getInfringementEmailBody(
      'Core',
      'Team',
      infringement,
      1,
      2,
      0,
      undefined,
      baseAdministrativeContent,
      5,
    );

    expect(result).toContain('Please complete ALL owed time this week (7 hours)');
    expect(result).toContain('5 hours commitment + 2 hours owed for last week = 7 hours required');
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
