const mongoose = require('mongoose');
const { parseISO, isValid, differenceInCalendarDays } = require('date-fns');
const Task = require('../models/task');

const TZ = 'America/Chicago';
const MAX_DAYS = 84; // 12 weeks
const ALLOWED_WEEKS = new Set([4, 8, 12]);
const COMPLETED_STATUSES = ['Completed', 'Closed'];

function bad(res, msg, code = 400) {
  return res.status(code).json({ error: msg });
}

function parseQuery(q) {
  const { start, end } = q;
  let weeks = Number(q.weeks ?? 8);
  if (!ALLOWED_WEEKS.has(weeks)) weeks = 8;

  if (!start || !end) return { error: 'Missing start or end.' };

  const startDate = parseISO(start);
  const endDate = parseISO(end);

  if (!isValid(startDate) || !isValid(endDate)) {
    return { error: 'Invalid date format. Use YYYY-MM-DD.' };
  }
  if (startDate > endDate) {
    return { error: 'start must be ≤ end.' };
  }

  const days = differenceInCalendarDays(endDate, startDate) + 1;
  if (days > MAX_DAYS) {
    return { error: 'Date range cannot exceed 12 weeks.' };
  }

  return { startDate, endDate, weeks };
}

// cache for $dateTrunc support check
let supportsDateTruncCache = null;
async function supportsDateTrunc() {
  if (supportsDateTruncCache != null) return supportsDateTruncCache;
  const info = await mongoose.connection.db.admin().serverInfo();
  const [maj] = (info.version || '0').split('.').map(Number);
  supportsDateTruncCache = maj >= 5;
  return supportsDateTruncCache;
}

// ---------- GET /api/tasks/trends ----------
async function getTrends(req, res) {
  const parsed = parseQuery(req.query);
  if (parsed.error) return bad(res, parsed.error);
  const { startDate, endDate, weeks } = parsed;

  try {
    const canTrunc = await supportsDateTrunc();

    // We consider tasks "completed" if status ∈ COMPLETED_STATUSES and use modifiedDatetime as completion timestamp
    const pipeline = [
      {
        $match: {
          isActive: { $ne: false },
          status: { $in: COMPLETED_STATUSES },
          modifiedDatetime: { $ne: null, $gte: startDate, $lte: endDate },
        },
      },
      canTrunc
        ? {
            $addFields: {
              weekStart: {
                $dateTrunc: {
                  date: '$modifiedDatetime',
                  unit: 'week',
                  startOfWeek: 'Mon',
                  timezone: TZ,
                },
              },
            },
          }
        : {
            $addFields: {
              isoWeek: { $isoWeek: '$modifiedDatetime' },
              isoWeekYear: { $isoWeekYear: '$modifiedDatetime' },
            },
          },
      canTrunc
        ? { $group: { _id: '$weekStart', completed: { $sum: 1 } } }
        : { $group: { _id: { y: '$isoWeekYear', w: '$isoWeek' }, completed: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ];

    const rows = await Task.aggregate(pipeline);

    // normalize group key to "YYYY-MM-DD" (Monday of the ISO week)
    const toISODateString = (groupKey) => {
      if (groupKey instanceof Date) {
        return groupKey.toISOString().slice(0, 10);
      }
      const { y, w } = groupKey;
      // Monday of ISO week `w` in year `y` (UTC)
      const jan4 = new Date(Date.UTC(y, 0, 4));
      const day = jan4.getUTCDay() || 7; // 1..7 (Mon..Sun)
      const mondayW1 = new Date(jan4);
      mondayW1.setUTCDate(jan4.getUTCDate() - (day - 1));
      const mondayW = new Date(mondayW1);
      mondayW.setUTCDate(mondayW1.getUTCDate() + (w - 1) * 7);
      return mondayW.toISOString().slice(0, 10);
    };

    const normalized = rows.map((r) => ({
      week: toISODateString(r._id),
      completed: r.completed,
    }));

    // Keep only last N buckets (4/8/12)
    const trimmed = normalized.slice(-weeks);

    return res.json(trimmed);
  } catch (e) {
    return bad(res, e.message || 'Server error', 500);
  }
}

// ---------- GET /api/tasks/summary ----------
async function getSummary(req, res) {
  const parsed = parseQuery(req.query);
  if (parsed.error) return bad(res, parsed.error);
  const { startDate, endDate } = parsed;

  try {
    // totalTasks: created up to endDate (active)
    const totalTasks = await Task.countDocuments({
      isActive: { $ne: false },
      createdDatetime: { $lte: endDate },
    });

    // Determine Monday-start of endDate's week (for completedThisWeek)
    const canTrunc = await supportsDateTrunc();
    let wkStart;
    let wkEnd;

    if (canTrunc) {
      const tmp = await Task.aggregate([
        { $limit: 1 },
        {
          $project: {
            wk: {
              $dateTrunc: {
                date: endDate,
                unit: 'week',
                startOfWeek: 'Mon',
                timezone: TZ,
              },
            },
          },
        },
      ]);
      wkStart = tmp[0]?.wk || new Date(endDate);
    } else {
      // ISO week Monday in UTC
      const d = new Date(
        Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()),
      );
      const day = d.getUTCDay() || 7;
      wkStart = new Date(d);
      wkStart.setUTCDate(d.getUTCDate() - (day - 1));
    }
    // eslint-disable-next-line prefer-const
    wkEnd = new Date(wkStart);
    wkEnd.setDate(wkStart.getDate() + 7); // exclusive

    // completedThisWeek: Completed/Closed with modifiedDatetime inside [wkStart, wkEnd)
    const completedThisWeek = await Task.countDocuments({
      isActive: { $ne: false },
      status: { $in: COMPLETED_STATUSES },
      modifiedDatetime: { $ne: null, $gte: wkStart, $lt: wkEnd },
    });

    // openTasks: not terminal as of endDate (created up to endDate)
    const openTasks = await Task.countDocuments({
      isActive: { $ne: false },
      createdDatetime: { $lte: endDate },
      $or: [{ status: { $nin: COMPLETED_STATUSES } }, { status: { $exists: false } }],
    });

    // averageCompletionTimeDays over [start, end] using modifiedDatetime - createdDatetime
    const avg = await Task.aggregate([
      {
        $match: {
          isActive: { $ne: false },
          status: { $in: COMPLETED_STATUSES },
          modifiedDatetime: { $ne: null, $gte: startDate, $lte: endDate },
          createdDatetime: { $ne: null },
        },
      },
      { $project: { diffMs: { $subtract: ['$modifiedDatetime', '$createdDatetime'] } } },
      { $group: { _id: null, avgMs: { $avg: '$diffMs' } } },
    ]);
    const averageCompletionTimeDays =
      avg[0]?.avgMs != null ? Number((avg[0].avgMs / (1000 * 60 * 60 * 24)).toFixed(1)) : 0;

    return res.json({
      totalTasks,
      completedThisWeek,
      openTasks,
      averageCompletionTimeDays,
    });
  } catch (e) {
    return bad(res, e.message || 'Server error', 500);
  }
}

module.exports = { getTrends, getSummary };
