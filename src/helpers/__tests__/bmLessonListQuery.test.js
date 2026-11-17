const {
  parseLessonListQuery: parse,
  buildTagFrequencyPipeline,
  LessonListQueryError,
} = require('../bmLessonListQuery');

describe('lesson list query validation', () => {
  test('legacy defaults do not filter, sort or paginate', () => {
    expect(parse()).toEqual({
      filter: {},
      sort: undefined,
      sortFields: undefined,
      pagination: null,
    });
  });
  test('unknown parameters remain ignored for legacy compatibility', () => {
    expect(parse({ unused: 'value' }).filter).toEqual({});
  });
  test.each([undefined, '', [], ['', ' ', '\t']])(
    'empty selections %p do not emit all:[]',
    (tags) => {
      expect(parse({ tags }).filter).toEqual({});
    },
  );
  test.each([
    ['all', '$all'],
    ['any', '$in'],
  ])('%s matching deduplicates exact tags', (tagMatch, operator) => {
    expect(parse({ tags: ['safety', 'safety', 'Safety', ' safety '], tagMatch }).filter).toEqual({
      tags: { [operator]: ['safety', 'Safety', ' safety '] },
    });
  });
  test('tags remain literal strings, not operators, regular expressions or comma lists', () => {
    expect(parse({ tags: ['$ne', '.*', 'a,b'] }).filter.tags.$all).toEqual(['$ne', '.*', 'a,b']);
  });
  test('bounded legacy tags are accepted beyond the current write-schema limit', () => {
    expect(parse({ tags: 'x'.repeat(100) }).filter.tags.$all[0]).toHaveLength(100);
  });
  test.each([
    { tags: {} },
    { tags: [null] },
    { tags: [['safety']] },
    { tags: true },
    { tags: 'x'.repeat(101) },
    { tags: Array(51).fill('safety') },
    { tagMatch: 'AND' },
    { tagMatch: ['all', 'any'] },
    { tagMatch: {} },
    { dateFilter: 'custom' },
    { dateFilter: '' },
    { dateFilter: ['thisWeek'] },
    { timeZone: 'Mars/Olympus' },
    { timeZone: '' },
    { timeZone: ['UTC'] },
    { timeZone: '+01:00' },
    { sort: '__proto__' },
    { sort: 'date' },
    { sort: {} },
    { sort: ['newest'] },
    { page: '0' },
    { page: '-1' },
    { page: '1.2' },
    { page: '1x' },
    { page: '1e2' },
    { page: '01' },
    { page: '' },
    { page: ['1', '2'] },
    { page: '9007199254740992' },
    { page: '9007199254740991' },
    { limit: '0' },
    { limit: '101' },
    { limit: '2.5' },
    { limit: '25x' },
    { limit: ['25'] },
    { limit: {} },
    { page: '100002', limit: '1' },
  ])('rejects invalid recognized query %p', (query) => {
    expect(() => parse(query)).toThrow(LessonListQueryError);
  });
  test.each([
    [{ page: '1' }, { page: 1, limit: 25, offset: 0 }],
    [{ limit: '100' }, { page: 1, limit: 100, offset: 0 }],
    [
      { page: '3', limit: '2' },
      { page: 3, limit: 2, offset: 4 },
    ],
    [
      { page: '100001', limit: '1' },
      { page: 100001, limit: 1, offset: 100000 },
    ],
  ])('explicit pagination %p defaults to newest', (query, expected) => {
    expect(parse(query).pagination).toEqual(expected);
    expect(parse(query).sort).toBe('newest');
  });
  test.each([
    ['newest', { date: -1, _id: -1 }],
    ['oldest', { date: 1, _id: 1 }],
    ['likes', { totalLikes: -1, _id: -1 }],
  ])('sort %s is whitelisted and deterministic', (sort, expected) => {
    expect(parse({ sort }).sortFields).toEqual(expected);
  });
});

describe('lesson calendar boundaries', () => {
  test.each([
    ['thisWeek', 'UTC', '2025-01-01T12:00:00Z', '2024-12-29T00:00:00Z', '2025-01-05T00:00:00Z'],
    ['thisWeek', 'UTC', '2025-01-05T00:00:00Z', '2025-01-05T00:00:00Z', '2025-01-12T00:00:00Z'],
    [
      'thisWeek',
      'America/Los_Angeles',
      '2024-03-13T12:00:00Z',
      '2024-03-10T08:00:00Z',
      '2024-03-17T07:00:00Z',
    ],
    [
      'thisWeek',
      'America/Los_Angeles',
      '2024-11-06T12:00:00Z',
      '2024-11-03T07:00:00Z',
      '2024-11-10T08:00:00Z',
    ],
    [
      'thisMonth',
      'America/Los_Angeles',
      '2024-03-01T00:30:00Z',
      '2024-02-01T08:00:00Z',
      '2024-03-01T08:00:00Z',
    ],
    [
      'thisMonth',
      'America/Los_Angeles',
      '2024-03-15T12:00:00Z',
      '2024-03-01T08:00:00Z',
      '2024-04-01T07:00:00Z',
    ],
    ['thisMonth', 'UTC', '2024-12-31T12:00:00Z', '2024-12-01T00:00:00Z', '2025-01-01T00:00:00Z'],
    [
      'thisYear',
      'Asia/Tokyo',
      '2024-12-31T16:00:00Z',
      '2024-12-31T15:00:00Z',
      '2025-12-31T15:00:00Z',
    ],
  ])('%s in %s at %s', (dateFilter, timeZone, now, start, end) => {
    const { date } = parse({ dateFilter, timeZone }, new Date(now)).filter;
    expect(date).toEqual({ $gte: new Date(start), $lt: new Date(end) });
  });
  test('UTC is the documented default timezone', () => {
    expect(parse({ dateFilter: 'thisYear' }, new Date('2025-01-01T00:00:00Z')).filter.date).toEqual(
      { $gte: new Date('2025-01-01T00:00:00Z'), $lt: new Date('2026-01-01T00:00:00Z') },
    );
  });
  test('all validates the timezone but adds no date predicate', () => {
    expect(parse({ dateFilter: 'all', timeZone: 'America/Los_Angeles' }).filter).toEqual({});
  });
});

describe('global tag frequency pipeline', () => {
  test('global lookup is uncorrelated and excludes neither filtered-out nor placeholder lessons', () => {
    const pipeline = buildTagFrequencyPipeline(
      parse({ tags: 'safety', sort: 'tagFrequency', page: '2', limit: '5' }),
      'isolatedLessons',
    );
    expect(pipeline[0]).toEqual({ $match: { tags: { $all: ['safety'] } } });
    const lookup = pipeline.find((stage) => stage.$lookup).$lookup;
    expect(lookup.from).toBe('isolatedLessons');
    expect(lookup).not.toHaveProperty('let');
    expect(lookup.pipeline.some((stage) => stage.$match)).toBe(false);
    expect(lookup.pipeline).toContainEqual({ $group: { _id: '$tags', frequency: { $sum: 1 } } });
    expect(pipeline.slice(-4)).toEqual([
      { $sort: { score: -1, 'lesson._id': -1 } },
      { $skip: 5 },
      { $limit: 5 },
      { $replaceRoot: { newRoot: '$lesson' } },
    ]);
  });
});
