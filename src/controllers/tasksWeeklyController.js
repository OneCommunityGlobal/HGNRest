const TERMINAL_STATUS_REGEX = /^(complete|completed|closed|done|finished)$/i;
const TERMINAL_STATUSES = ['Completed', 'Closed', 'Complete'];
// eslint-disable-next-line no-unused-vars
const mongoose = require('mongoose');
const { startOfWeek, endOfWeek, addWeeks, differenceInCalendarDays, isValid } = require('date-fns');
const { zonedTimeToUtc, format } = require('date-fns-tz');
const { z } = require('zod');
const Task = require('../models/task'); // adjust path if needed

const TZ = 'America/Chicago';
const MAX_WEEKS = 12;
const ALLOWED_WEEKS = new Set([4, 8, 12]);

function parseDateOnlyInZone(dateStr) {
  if (!dateStr) return null;
  return zonedTimeToUtc(`${dateStr}T00:00:00`, TZ);
}

const querySchema = z
  .object({
    start: z.string().optional(),
    end: z.string().optional(),
    weeks: z.union([z.string(), z.number()]).optional(),
  })
  .transform((raw) => {
    const now = new Date();

    const defaultEnd = endOfWeek(now, { weekStartsOn: 1 });
    const defaultStart = addWeeks(startOfWeek(defaultEnd, { weekStartsOn: 1 }), -7);

    const start = raw.start ? parseDateOnlyInZone(raw.start) : defaultStart;
    const end = raw.end ? parseDateOnlyInZone(raw.end) : defaultEnd;

    if (!isValid(start) || !isValid(end) || end < start) {
      const err = new Error('Invalid start or end date.');
      err.status = 400;
      throw err;
    }

    const startWeek = startOfWeek(start, { weekStartsOn: 1 });
    const endWeek = endOfWeek(end, { weekStartsOn: 1 });

    const weeksNormalized =
      raw.weeks === undefined || raw.weeks === '' ? undefined : Number(raw.weeks);

    if (weeksNormalized !== undefined && !ALLOWED_WEEKS.has(weeksNormalized)) {
      const err = new Error('weeks must be one of 4, 8, 12');
      err.status = 400;
      throw err;
    }

    const rangeDays = differenceInCalendarDays(endWeek, startWeek) + 1;
    if (rangeDays > MAX_WEEKS * 7) {
      const err = new Error('Date range cannot exceed 12 weeks.');
      err.status = 400;
      throw err;
    }

    const weeks = weeksNormalized ?? 8;

    return { startWeek, endWeek, weeks };
  });

function buildWeekBuckets(endWeekZoned, weeks) {
  const buckets = [];
  let cursor = endWeekZoned;

  for (let i = 0; i < weeks; i += 1) {
    const wEndZ = cursor;
    const wStartZ = startOfWeek(wEndZ, { weekStartsOn: 1 });

    buckets.push({
      startUTC: wStartZ,
      endUTC: wEndZ,
      label: format(wStartZ, 'yyyy-MM-dd', { timeZone: TZ }),
    });

    cursor = addWeeks(wEndZ, -1);
  }

  return buckets.reverse();
}

/** GET /api/tasks/trends
 * Params: start (ISO), end (ISO), weeks (4|8|12 default 8)
 * Return: [{ week: 'YYYY-MM-DD', completed: number }, ...]
 */
async function getTrends(req, res) {
  try {
    const { startWeek, endWeek, weeks } = querySchema.parse(req.query);

    const buckets = buildWeekBuckets(endWeek, weeks);
    const rangeStartUTC = startWeek;
    const rangeEndUTC = endWeek;

    const tasks = await Task.aggregate([
      {
        $match: {
          deleted: { $ne: true },
          isActive: { $ne: false },
          $or: [
            { createdDatetime: { $gte: rangeStartUTC, $lte: rangeEndUTC } },
            {
              createdDatetime: { $exists: false },
              modifiedDatetime: { $gte: rangeStartUTC, $lte: rangeEndUTC },
            },
            { completedDatetime: { $ne: null, $gte: rangeStartUTC, $lte: rangeEndUTC } },
            {
              completedDatetime: null,
              status: { $regex: TERMINAL_STATUS_REGEX },
              modifiedDatetime: { $gte: rangeStartUTC, $lte: rangeEndUTC },
            },
            {
              'resources.completedTask': true,
              modifiedDatetime: { $gte: rangeStartUTC, $lte: rangeEndUTC },
            },
          ],
        },
      },
      {
        $project: {
          createdDatetime: 1,
          modifiedDatetime: 1,
          completedDatetime: 1,
          status: 1,
          resources: 1,
        },
      },
    ]);

    const counts = Object.fromEntries(buckets.map((b) => [b.label, { assigned: 0, completed: 0 }]));

    for (const t of tasks) {
      for (const b of buckets) {
        const bucketStart = b.startUTC < rangeStartUTC ? rangeStartUTC : b.startUTC;
        const bucketEnd = b.endUTC > rangeEndUTC ? rangeEndUTC : b.endUTC;
        const assignedAt = t.createdDatetime || t.modifiedDatetime;
        const completedAt = t.completedDatetime || t.modifiedDatetime;
        const isCompleted =
          (t.completedDatetime &&
            t.completedDatetime >= bucketStart &&
            t.completedDatetime <= bucketEnd) ||
          (!t.completedDatetime &&
            TERMINAL_STATUS_REGEX.test(t.status || '') &&
            t.modifiedDatetime >= bucketStart &&
            t.modifiedDatetime <= bucketEnd) ||
          (t.resources?.some((resource) => resource.completedTask === true) &&
            t.modifiedDatetime >= bucketStart &&
            t.modifiedDatetime <= bucketEnd);

        if (assignedAt >= bucketStart && assignedAt <= bucketEnd) {
          counts[b.label].assigned += 1;
        }
        if (isCompleted && completedAt >= bucketStart && completedAt <= bucketEnd) {
          counts[b.label].completed += 1;
        }
      }
    }

    const data = buckets.map((b) => ({ week: b.label, ...counts[b.label] }));
    return res.json(data);
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message || 'Invalid request' });
  }
}

/** GET /api/tasks/summary
 * Return:
 * {
 *   totalTasks,
 *   completedThisWeek,
 *   openTasks,
 *   averageCompletionTimeDays
 * }
 */
async function getSummary(req, res) {
  try {
    const { startWeek, endWeek, weeks } = querySchema.parse(req.query);

    const buckets = buildWeekBuckets(endWeek, weeks);
    const latest = buckets[buckets.length - 1];

    const totalTasksPromise = Task.countDocuments({
      createdDatetime: { $lte: endWeek },
      deleted: { $ne: true },
    });

    const completedThisWeekPromise = Task.countDocuments({
      deleted: { $ne: true },
      isActive: { $ne: false },
      $or: [
        { completedDatetime: { $ne: null, $gte: latest.startUTC, $lte: latest.endUTC } },
        {
          completedDatetime: null,
          status: { $regex: TERMINAL_STATUS_REGEX },
          modifiedDatetime: { $gte: latest.startUTC, $lte: latest.endUTC },
        },
        {
          'resources.completedTask': true,
          modifiedDatetime: { $gte: latest.startUTC, $lte: latest.endUTC },
        },
      ],
    });

    const openTasksPromise = Task.countDocuments({
      deleted: { $ne: true },
      createdDatetime: { $lte: endWeek },
      status: { $nin: TERMINAL_STATUSES },
    });

    const avgAggPromise = Task.aggregate([
      {
        $match: {
          deleted: { $ne: true },
          completedDatetime: {
            $ne: null,
            $gte: startWeek,
            $lte: endWeek,
          },
          createdDatetime: { $ne: null },
        },
      },
      { $project: { diffMs: { $subtract: ['$completedDatetime', '$createdDatetime'] } } },
      { $group: { _id: null, avgMs: { $avg: '$diffMs' } } },
    ]);

    const [totalTasks, completedThisWeek, openTasks, avgAgg] = await Promise.all([
      totalTasksPromise,
      completedThisWeekPromise,
      openTasksPromise,
      avgAggPromise,
    ]);

    const averageCompletionTimeDays = avgAgg?.[0]?.avgMs
      ? avgAgg[0].avgMs / (1000 * 60 * 60 * 24)
      : 0;

    return res.json({
      totalTasks,
      completedThisWeek,
      openTasks,
      averageCompletionTimeDays: Number(averageCompletionTimeDays.toFixed(1)),
    });
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message || 'Invalid request' });
  }
}

module.exports = { getTrends, getSummary };
