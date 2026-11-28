const moment = require('moment-timezone');

const MAX_TAGS = 20;
// Query existing data without assuming every historical write enforced the 10-character schema limit.
const MAX_TAG_LENGTH = 100;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const MAX_OFFSET = 100000;
const SORTS = {
  newest: { date: -1, _id: -1 },
  oldest: { date: 1, _id: 1 },
  likes: { totalLikes: -1, _id: -1 },
};

class LessonListQueryError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LessonListQueryError';
  }
}

const selection = (value, allowed, name, fallback) => {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new LessonListQueryError(`Invalid ${name}. Allowed values: ${allowed.join(', ')}.`);
  }
  return value;
};

const positiveInteger = (value, name, fallback) => {
  if (value === undefined) return fallback;
  if (
    typeof value !== 'string' ||
    !/^[1-9]\d*$/.test(value) ||
    !Number.isSafeInteger(Number(value))
  ) {
    throw new LessonListQueryError(`${name} must be a positive integer.`);
  }
  return Number(value);
};

const parseTags = (value) => {
  if (value === undefined) return [];
  if (
    (typeof value !== 'string' && !Array.isArray(value)) ||
    (Array.isArray(value) && value.some((tag) => typeof tag !== 'string'))
  ) {
    throw new LessonListQueryError(
      `tags must be a string or an array of strings. Use repeated unindexed parameters (tags=first&tags=second), with at most ${MAX_TAGS} supplied entries.`,
    );
  }
  const values = Array.isArray(value) ? value : [value];
  if (values.length > MAX_TAGS) {
    throw new LessonListQueryError(`Use at most ${MAX_TAGS} supplied tag entries before deduplication.`);
  }
  if (values.some((tag) => tag.length > MAX_TAG_LENGTH)) {
    throw new LessonListQueryError(
      `tags must contain strings of at most ${MAX_TAG_LENGTH} characters.`,
    );
  }
  // Preserve the actual tag value (including case/spacing); only blank selections are ignored.
  return [...new Set(values.filter((tag) => tag.trim()))];
};

const dateBounds = (preset, timeZone, now) => {
  if (preset === 'all') return null;
  const start = moment.tz(now, timeZone);
  let end;
  if (preset === 'thisWeek') {
    start.startOf('day').subtract(start.day(), 'days');
    end = start.clone().add(1, 'week');
  } else if (preset === 'thisMonth') {
    start.startOf('month');
    end = start.clone().add(1, 'month');
  } else {
    start.startOf('year');
    end = start.clone().add(1, 'year');
  }
  return { $gte: start.toDate(), $lt: end.toDate() };
};

/** Legacy requests remain unbounded and unsorted; only explicit pagination opts into an envelope. */
const parseLessonListQuery = (query = {}, now = new Date()) => {
  const tags = parseTags(query.tags);
  const tagMatch = selection(query.tagMatch, ['all', 'any'], 'tagMatch', 'all');
  const dateFilter = selection(
    query.dateFilter,
    ['all', 'thisWeek', 'thisMonth', 'thisYear'],
    'dateFilter',
    'all',
  );
  const timeZone = query.timeZone === undefined ? 'UTC' : query.timeZone;
  if (typeof timeZone !== 'string' || timeZone.length > 100 || !moment.tz.zone(timeZone)) {
    throw new LessonListQueryError('timeZone must be a recognized IANA time zone.');
  }
  const paginated = query.page !== undefined || query.limit !== undefined;
  const sort = selection(
    query.sort,
    ['newest', 'oldest', 'likes', 'tagFrequency'],
    'sort',
    paginated ? 'newest' : undefined,
  );
  const filter = {};
  if (tags.length) filter.tags = { [tagMatch === 'all' ? '$all' : '$in']: tags };
  const dates = dateBounds(dateFilter, timeZone, now);
  if (dates) filter.date = dates;
  let pagination = null;
  if (paginated) {
    const page = positiveInteger(query.page, 'page', 1);
    const limit = positiveInteger(query.limit, 'limit', DEFAULT_LIMIT);
    const offset = (page - 1) * limit;
    if (limit > MAX_LIMIT) throw new LessonListQueryError(`limit must not exceed ${MAX_LIMIT}.`);
    if (!Number.isSafeInteger(offset) || offset > MAX_OFFSET) {
      throw new LessonListQueryError(`Pagination offset must not exceed ${MAX_OFFSET}.`);
    }
    pagination = { page, limit, offset };
  }
  return { filter, sort, sortFields: SORTS[sort], pagination };
};

/**
 * The lookup is deliberately uncorrelated: global occurrences are computed independently
 * of the outer match and are eligible for MongoDB's uncorrelated-subquery cache.
 * It transfers tag counts, not whole lessons. Repeated tags count on both sides, matching
 * the existing frontend's forEach/reduce semantics. All temporary fields live outside lesson.
 */
const buildTagFrequencyPipeline = ({ filter, pagination }, collectionName) => {
  const pipeline = [
    { $match: filter },
    { $replaceRoot: { newRoot: { lesson: '$$ROOT' } } },
    {
      $lookup: {
        from: collectionName,
        pipeline: [
          { $project: { tags: 1, _id: 0 } },
          { $unwind: '$tags' },
          { $group: { _id: '$tags', frequency: { $sum: 1 } } },
        ],
        as: 'tagCounts',
      },
    },
    {
      $addFields: {
        score: {
          $sum: {
            $map: {
              input: { $cond: [{ $isArray: '$lesson.tags' }, '$lesson.tags', []] },
              as: 'tag',
              in: {
                $let: {
                  vars: {
                    count: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: '$tagCounts',
                            as: 'count',
                            cond: { $eq: ['$$count._id', '$$tag'] },
                          },
                        },
                        0,
                      ],
                    },
                  },
                  in: { $ifNull: ['$$count.frequency', 0] },
                },
              },
            },
          },
        },
      },
    },
    { $project: { tagCounts: 0 } },
    { $sort: { score: -1, 'lesson._id': -1 } },
  ];
  if (pagination) pipeline.push({ $skip: pagination.offset }, { $limit: pagination.limit });
  pipeline.push({ $replaceRoot: { newRoot: '$lesson' } });
  return pipeline;
};

module.exports = { parseLessonListQuery, buildTagFrequencyPipeline, LessonListQueryError };
