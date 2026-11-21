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

  it('should include Full name in Administrative Details formatted with firstName and lastName', () => {
    const infringement = {
      date: '2026-09-10',
      description: `System auto-assigned infringement for not meeting weekly volunteer time commitment.`,
    };

    const result = getInfringementEmailBody(
      'John',
      'Doe',
      infringement,
      1,
      undefined,
      null,
      null,
      baseAdministrativeContent,
    );

    expect(result).toContain('<p><b>Name:</b> John Doe</p>');
  });

  it('adds a red (Closing Out) label to the left of the name when isClosingOut is true', () => {
    const infringement = {
      date: '2026-09-10',
      description: 'Missed weekly time commitment.',
    };

    const result = getInfringementEmailBody(
      'Sagar',
      'Chavan',
      infringement,
      1,
      undefined,
      null,
      null,
      { ...baseAdministrativeContent, isClosingOut: true },
    );

    expect(result).toContain(
      '<p><b>Name:</b> <span style="color: red;"><b>(Closing Out)</b></span> Sagar Chavan</p>',
    );
  });

  it('does not show (Closing Out) when isClosingOut is false', () => {
    const infringement = {
      date: '2026-09-10',
      description: 'Missed weekly time commitment.',
    };

    const result = getInfringementEmailBody(
      'Sagar',
      'Chavan',
      infringement,
      1,
      undefined,
      null,
      null,
      { ...baseAdministrativeContent, isClosingOut: false },
    );

    expect(result).not.toContain('(Closing Out)');
    expect(result).toContain('<p><b>Name:</b> Sagar Chavan</p>');
  });

  it('does not show (Closing Out) when isClosingOut is not provided', () => {
    const infringement = {
      date: '2026-09-10',
      description: 'Missed weekly time commitment.',
    };

    const result = getInfringementEmailBody(
      'Sagar',
      'Chavan',
      infringement,
      1,
      undefined,
      null,
      null,
      baseAdministrativeContent,
    );

    expect(result).not.toContain('(Closing Out)');
  });

  it('shows (Closing Out) in the Administrative Details section only, not in the greeting', () => {
    const infringement = {
      date: '2026-09-10',
      description: 'Missed weekly time commitment.',
    };

    const result = getInfringementEmailBody(
      'Sagar',
      'Chavan',
      infringement,
      1,
      undefined,
      null,
      null,
      { ...baseAdministrativeContent, isClosingOut: true },
    );

    const [beforeAdminDetails, adminDetails] = result.split(
      '<p><b>ADMINISTRATIVE DETAILS:</b></p>',
    );

    expect(beforeAdminDetails).not.toContain('(Closing Out)');
    expect(adminDetails).toContain('(Closing Out)');
    expect(result).toContain('Dear <b>Sagar</b>,');
  });

  it('shows (Closing Out) for the time-remaining (Core Team) email variant too', () => {
    const infringement = {
      date: '2026-09-10',
      description: 'Missed weekly time commitment.',
    };

    const result = getInfringementEmailBody(
      'Sagar',
      'Chavan',
      infringement,
      6,
      4,
      1,
      undefined,
      { ...baseAdministrativeContent, isClosingOut: true },
      10,
    );

    expect(result).toContain('(Closing Out)');
    expect(result).toContain('Sagar Chavan');
  });

  it('uses a neutral "Dear" greeting instead of a time-of-day greeting', () => {
    const infringement = {
      date: '2025-05-12',
      description: 'Missed weekly time commitment.',
    };

    const result = getInfringementEmailBody(
      'Maria',
      'Gomez',
      infringement,
      1,
      undefined,
      null,
      null,
      baseAdministrativeContent,
    );

    expect(result).toContain('Dear <b>Maria</b>,');
    expect(result).not.toContain('Good Morning');
    expect(result).not.toContain('Good Afternoon');
    expect(result).not.toContain('Good Evening');
  });
});
