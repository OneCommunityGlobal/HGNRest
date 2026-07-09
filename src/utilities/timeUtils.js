const moment = require('moment-timezone');

// converts date to desired format such as Aug-30-2023 in Pacific time
const formatDateAndTime = (date) =>
  moment.tz(date, 'America/Los_Angeles').format('MMM-DD-YY, h:mm:ss a');

const formatDate = (date) => moment.tz(date, 'America/Los_Angeles').format('MMM-DD-YY');

// converts time to AM/PM format in Pacific time. E.g., '2023-09-21T07:08:09-07:00' becomes '7:08:09 AM'.
const formattedAmPmTime = (date) => moment.tz(date, 'America/Los_Angeles').format('h:mm:ss A');

const formatCreatedDate = (date) => moment.tz(date, 'America/Los_Angeles').format('MM/DD');

/**
 * Constants for day of week. Starting from Sunday.
 */
const DAY_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 *
 * @param {String} utcTs A UTC timestamp String
 * @returns {Number} The day of the week. Starting from Sunday. 0 -> Sunday
 */
const getDayOfWeekStringFromUTC = (utcTs) => moment.utc(utcTs).day();

module.exports = {
  formatDateAndTime,
  formatDate,
  formattedAmPmTime,
  formatCreatedDate,
  DAY_OF_WEEK,
  getDayOfWeekStringFromUTC,
};
