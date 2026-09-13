/**
 * Tests for the emails sent when a user is paused.
 *
 * The pause email reported a return date one day after the reactivation date,
 * compensating for a date that was itself being stored a day early. With the
 * date stored correctly, the email has to name the reactivation date itself,
 * which is also what the bug report asks for: the person comes back on the day
 * they were paused to.
 */

jest.mock('../../models/userProfile', () => ({
  find: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn().mockResolvedValue({}),
  aggregate: jest.fn(),
  updateOne: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../models/badge', () => ({ find: jest.fn(), findOne: jest.fn() }));
jest.mock('../../models/team', () => ({ aggregate: jest.fn(), find: jest.fn() }));
jest.mock('../dashboardhelper', () => jest.fn(() => ({ laborthisweek: jest.fn() })));
jest.mock('../../utilities/emailSender', () => jest.fn());
jest.mock('../../startup/logger', () => ({ logInfo: jest.fn(), logException: jest.fn() }));

const emailSender = require('../../utilities/emailSender');
const userHelperFactory = require('../userHelper');

const { sendUserPausedEmail } = userHelperFactory();

const emailBody = () => emailSender.mock.calls[0][2];

describe('sendUserPausedEmail', () => {
  beforeEach(() => jest.clearAllMocks());

  test('names the day the user is due back, not the day after', () => {
    // Start of 2026-09-20 in company time.
    sendUserPausedEmail({
      firstName: 'Ann',
      lastName: 'Adams',
      email: 'ann@example.com',
      reactivationDate: new Date('2026-09-20T07:00:00.000Z'),
      recipients: ['admin@example.com'],
    });

    expect(emailBody()).toContain('9-20-2026');
    expect(emailBody()).not.toContain('9-21-2026');
  });
});
