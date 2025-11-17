const TERMINAL_STATUSES = ['Completed', 'Closed', 'Complete'];
// eslint-disable-next-line no-unused-vars
const mongoose = require('mongoose');
const {
  startOfWeek,
  endOfWeek,
  addWeeks,
  differenceInCalendarDays,
  isValid,
  parseISO,
} = require('date-fns');
const { utcToZonedTime, zonedTimeToUtc, format } = require('date-fns-tz');
const { z } = require('zod');
const Task = require('../models/task'); // adjust path if needed

const TZ = 'America/Chicago';
const MAX_WEEKS = 12;
const ALLOWED_WEEKS = new Set([4, 8, 12]);

const querySchema = z
  .object({
    start: z.string().optional(),
    end: z.string().optional(),
    // weeks may be "4" | "8" | "12" or 4 | 8 | 12, or omitted entirely
    weeks: z.union([z.string(), z.number()]).optional(),
  })
  .transform((raw) => {
    const now = new Date();
    const zonedNow = utcToZonedTime(now, TZ);

    const defaultEnd = endOfWeek(zonedNow, { weekStartsOn: 1 });
    const defaultStart = addWeeks(defaultEnd, -8);

    const end = raw.end ? parseISO(raw.end) : defaultEnd;
    const start = raw.start ? parseISO(raw.start) : defaultStart;

    if (!isValid(start) || !isValid(end) || end < start) {
      const err = new Error('Invalid start or end date.');
      err.status = 400;
      throw err;
    }

    const startZ = utcToZonedTime(start, TZ);
    const endZ = utcToZonedTime(end, TZ);

    const startWeek = startOfWeek(startZ, { weekStartsOn: 1 });
    const endWeek = endOfWeek(endZ, { weekStartsOn: 1 });

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
      startUTC: zonedTimeToUtc(wStartZ, TZ),
      endUTC: zonedTimeToUtc(wEndZ, TZ),
      // safer format token for date-fns v2:
      label: format(wStartZ, 'yyyy-MM-dd', { timeZone: TZ }),
    });
    cursor = addWeeks(wEndZ, -1);
  }
  return buckets.reverse(); // ascending
}

/** GET /api/tasks/trends
 * Params: start (ISO), end (ISO), weeks (4|8|12 default 8)
 * Return: [{ week: 'YYYY-MM-DD', completed: number }, ...]
 */
async function getTrends(req, res) {
  try {
    // eslint-disable-next-line no-unused-vars
    const { startWeek, endWeek, weeks } = querySchema.parse(req.query);

    const buckets = buildWeekBuckets(endWeek, weeks);
    const rangeStartUTC = buckets[0].startUTC;
    const rangeEndUTC = buckets[buckets.length - 1].endUTC;

    // Pull all completions in the N-week range
    const tasks = await Task.aggregate([
      {
        $match: {
          completedDatetime: { $ne: null, $gte: rangeStartUTC, $lte: rangeEndUTC },
        },
      },
      { $project: { completedDatetime: 1 } },
    ]);

    // JS bucket counts (fine for small N)
    const counts = Object.fromEntries(buckets.map((b) => [b.label, 0]));
    // eslint-disable-next-line no-restricted-syntax
    for (const t of tasks) {
      // eslint-disable-next-line no-restricted-syntax
      for (const b of buckets) {
        if (t.completedDatetime >= b.startUTC && t.completedDatetime <= b.endUTC) {
          counts[b.label] += 1;
          break;
        }
      }
    }

    const data = buckets.map((b) => ({ week: b.label, completed: counts[b.label] || 0 }));
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
    const latest = buckets[buckets.length - 1]; // “This Week”

    const totalTasksPromise = Task.countDocuments({
      createdDatetime: { $lte: zonedTimeToUtc(endWeek, TZ) },
      deleted: { $ne: true },
    });

    const completedThisWeekPromise = Task.countDocuments({
      completedDatetime: { $ne: null, $gte: latest.startUTC, $lte: latest.endUTC },
    });

    const openTasksPromise = Task.countDocuments({
      deleted: { $ne: true },
      createdDatetime: { $lte: zonedTimeToUtc(endWeek, TZ) },
      status: { $nin: TERMINAL_STATUSES }, // <- no OR, just “not terminal”
    });

    const avgAggPromise = Task.aggregate([
      {
        $match: {
          deleted: { $ne: true },
          completedDatetime: {
            $ne: null,
            $gte: zonedTimeToUtc(startWeek, TZ),
            $lte: zonedTimeToUtc(endWeek, TZ),
          },
          createdDatetime: { $ne: null }, // <- exclude missing created dates
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
