const moment = require('moment-timezone');

const GRACE_HOURS = 24;
const DAYS_IN_WEEK = 7;
const MAX_DAY_OF_WEEK = 6;
const MAX_HOUR = 23;
const MAX_MINUTE = 59;

const DEFAULT_SETTINGS = {
  enabled: false,
  dayOfWeek: 0,
  hour: 8,
  minute: 0,
  timezone: 'America/Los_Angeles',
};

// The instant this week's send is scheduled for, in the schedule's timezone.
const getScheduledFor = (now, settings) =>
  moment
    .tz(now, settings.timezone)
    .startOf('week')
    .add(settings.dayOfWeek, 'days')
    .hour(settings.hour)
    .minute(settings.minute)
    .toDate();

// Due from the scheduled time until the grace window closes, so a restart or a failed
// tick still gets the email out, but a long outage does not send a stale report.
const isDue = (now, settings) => {
  if (!settings.enabled) return false;
  const scheduledFor = moment(getScheduledFor(now, settings));
  const t = moment(now);
  return !t.isBefore(scheduledFor) && t.isBefore(scheduledFor.clone().add(GRACE_HOURS, 'hours'));
};

// Next send after now; when this week's send already went out it is next week's.
const getNextSend = (now, settings, alreadySentThisWeek) => {
  const scheduledFor = moment(getScheduledFor(now, settings));
  const pastOrDone = moment(now).isSameOrAfter(scheduledFor) && alreadySentThisWeek;
  const missed = moment(now).isSameOrAfter(scheduledFor.clone().add(GRACE_HOURS, 'hours'));
  if (!pastOrDone && !missed) return scheduledFor.toDate();
  return moment(getScheduledFor(moment(now).add(DAYS_IN_WEEK, 'days').toDate(), settings)).toDate();
};

const validateSettings = (input) => {
  const errors = [];
  const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
  if (input.enabled !== undefined && typeof input.enabled !== 'boolean') {
    errors.push('enabled must be a boolean');
  }
  if (input.dayOfWeek !== undefined && !isInt(input.dayOfWeek, 0, MAX_DAY_OF_WEEK)) {
    errors.push('dayOfWeek must be an integer from 0 (Sunday) to 6');
  }
  if (input.hour !== undefined && !isInt(input.hour, 0, MAX_HOUR)) {
    errors.push('hour must be an integer from 0 to 23');
  }
  if (input.minute !== undefined && !isInt(input.minute, 0, MAX_MINUTE)) {
    errors.push('minute must be an integer from 0 to 59');
  }
  if (input.timezone !== undefined && !moment.tz.zone(input.timezone)) {
    errors.push('timezone must be a valid IANA timezone');
  }
  if (
    input.alertRecipients !== undefined &&
    !(
      Array.isArray(input.alertRecipients) &&
      input.alertRecipients.every((e) => typeof e === 'string' && /^\S+@\S+\.\S+$/.test(e))
    )
  ) {
    errors.push('alertRecipients must be an array of email addresses');
  }
  return errors;
};

module.exports = { GRACE_HOURS, DEFAULT_SETTINGS, getScheduledFor, isDue, getNextSend, validateSettings };
