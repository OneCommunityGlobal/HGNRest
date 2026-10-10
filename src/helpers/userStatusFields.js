const moment = require('moment-timezone');
const { COMPANY_TZ } = require('../constants/company');
const { InactiveReason } = require('../constants/userProfile');

/**
 * One source of truth for the fields that say where a user is in their
 * lifecycle.
 *
 * Pause and resume are reachable from two endpoints, `pauseResumeUser` (the
 * Pause and Resume buttons) and `changeUserStatus` (the lifecycle actions), and
 * the nightly job reactivates paused users on a third path. They have to write
 * the same fields, because everything downstream reads them: `deactivatedAt` is
 * the paused-on date in the resume email, a leftover `endDate` shows as a final
 * day on a paused profile, and a leftover `reactivationDate` makes
 * `finalizeUserEndDates` skip the user forever as still-paused.
 */

/**
 * The start of a calendar day in company time.
 *
 * The date picker sends 'YYYY-MM-DD' with no zone. Parsing that and converting
 * afterwards reads it in the server's zone first, which is UTC in production,
 * so the result lands on the previous Pacific day and the user comes back a day
 * early. Anchoring the parse in company time keeps the day the admin picked.
 */
const startOfCompanyDay = (date) => moment.tz(date, COMPANY_TZ).startOf('day').toISOString();

/** Fields written when a user is paused until `reactivationDate`. */
const pauseFields = (reactivationDate) => ({
  isActive: false,
  inactiveReason: InactiveReason.PAUSED,
  deactivatedAt: moment().tz(COMPANY_TZ).toISOString(),
  reactivationDate: startOfCompanyDay(reactivationDate),
  endDate: null,
  isSet: false,
});

/**
 * Fields written when a user is made active, whether by the Resume button, the
 * lifecycle Activate action, or the nightly reactivation job.
 */
const activeFields = () => ({
  isActive: true,
  inactiveReason: undefined,
  deactivatedAt: null,
  reactivationDate: null,
  endDate: null,
  isSet: false,
  finalEmailThreeWeeksSent: false,
});

/** The fields above, listed for a `findById` projection. */
const LIFECYCLE_PROJECTION =
  'isActive inactiveReason deactivatedAt reactivationDate endDate isSet finalEmailThreeWeeksSent';

module.exports = {
  startOfCompanyDay,
  pauseFields,
  activeFields,
  LIFECYCLE_PROJECTION,
};
