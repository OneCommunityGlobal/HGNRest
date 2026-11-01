const mongoose = require('mongoose');
const moment = require('moment-timezone');
const UserProfile = require('../models/userProfile');
const { hasPermission } = require('../utilities/permissions');

// Weekly summary completion is only shown to people allowed to manage the HGN dashboard.
const SUMMARY_STATUS_VIEW_PERMISSION = 'accessHgnSkillsDashboard';

// Weekly summaries are due at the end of the week in Pacific time (see userProfile.weeklySummaries).
const SUMMARY_TIMEZONE = 'America/Los_Angeles';

// Only the current week's entry (weeklySummaries[0]) is needed to compute status.
const SUMMARY_STATUS_PROJECTION = { weeklySummaryNotReq: 1, weeklySummaries: { $slice: 1 } };

const WEEKLY_SUMMARY_STATUS = {
  COMPLETED: 'completed',
  INCOMPLETE: 'incomplete',
  NOT_REQUIRED: 'notRequired',
};

/**
 * Weekly summary completion for the current reporting week (Pacific time).
 * weeklySummaries[0] is the current week's entry; it only counts if its due date falls in the
 * current week and it has non-empty text.
 */
const getWeeklySummaryStatus = (profile, now = new Date()) => {
  if (!profile) return null;
  if (profile.weeklySummaryNotReq) return WEEKLY_SUMMARY_STATUS.NOT_REQUIRED;

  const current = Array.isArray(profile.weeklySummaries) ? profile.weeklySummaries[0] : null;
  const weekStart = moment(now).tz(SUMMARY_TIMEZONE).startOf('week');
  const weekEnd = moment(now).tz(SUMMARY_TIMEZONE).endOf('week');
  const dueDate = current?.dueDate ? moment(current.dueDate) : null;
  const isCurrentWeek = dueDate?.isValid() && dueDate.isBetween(weekStart, weekEnd, null, '[]');
  const hasText = typeof current?.summary === 'string' && current.summary.trim() !== '';

  return isCurrentWeek && hasText
    ? WEEKLY_SUMMARY_STATUS.COMPLETED
    : WEEKLY_SUMMARY_STATUS.INCOMPLETE;
};

const canViewWeeklySummaryStatus = async (requestor) =>
  Boolean(requestor) && hasPermission(requestor, SUMMARY_STATUS_VIEW_PERMISSION);

/**
 * Builds { [userId]: status } for the given users in one query, or returns null when the
 * requestor may not see summary status (callers then omit the field entirely).
 */
const getWeeklySummaryStatusMap = async (requestor, userIds, now = new Date()) => {
  if (!(await canViewWeeklySummaryStatus(requestor))) return null;

  const ids = [...new Set(userIds.filter(Boolean).map(String))].filter((id) =>
    mongoose.Types.ObjectId.isValid(id),
  );
  if (!ids.length) return {};

  const profiles = await UserProfile.find({ _id: { $in: ids } }, SUMMARY_STATUS_PROJECTION).lean();

  return profiles.reduce((acc, profile) => {
    acc[profile._id.toString()] = getWeeklySummaryStatus(profile, now);
    return acc;
  }, {});
};

module.exports = {
  WEEKLY_SUMMARY_STATUS,
  SUMMARY_STATUS_PROJECTION,
  getWeeklySummaryStatus,
  canViewWeeklySummaryStatus,
  getWeeklySummaryStatusMap,
};
