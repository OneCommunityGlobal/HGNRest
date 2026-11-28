jest.mock('../../../startup/logger', () => ({ logException: jest.fn() }));
const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Base = require('../../../models/bmdashboard/buildingNewLesson');
const routes = require('../../../routes/bmdashboard/bmNewLessonRouter');

// Always create our own server; never read a shared database URI or application .env.
describe('lesson-list queries against disposable MongoDB', () => {
  let mongo;
  let connection;
  let Lesson;
  let app;
  const author = new mongoose.Types.ObjectId();
  const project = new mongoose.Types.ObjectId();
  const seed = [
    ['A', ['safety', 'concrete'], 2],
    ['B', ['safety'], 10],
    ['C', ['concrete', 'water'], 5],
    ['D', ['water'], 5],
    ['Tag Storage', ['safety'], 0],
    ['F', [], 1],
    ['G', ['water', 'water'], 0],
  ].map(([title, tags, totalLikes], i) => ({
    _id: new mongoose.Types.ObjectId(`507f1f77bcf86cd79943900${i + 1}`),
    title,
    tags,
    totalLikes,
    content: 'Integration lesson',
    date: new Date(Date.UTC(2024, i, 1)),
    author,
    relatedProject: project,
    allowedRoles: 'All',
    files: [
      { data: Buffer.from('file bytes'), contentType: 'text/plain', filename: 'fixture.txt' },
    ],
  }));
  const titles = (data) => data.map((doc) => doc.title);
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create({
      instance: { ip: '127.0.0.1', dbName: 'lesson_filters_disposable' },
    });
    const uri = mongo.getUri('lesson_filters_disposable');
    expect(uri).toMatch(/^mongodb:\/\/127\.0\.0\.1:/);
    connection = mongoose.createConnection(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      autoIndex: false,
    });
    await new Promise((resolve, reject) => {
      connection.once('open', resolve);
      connection.once('error', reject);
    });
    Lesson = connection.model('buildingNewLesson', Base.schema, 'buildingNewLessons');
    app = express();
    app.use('/api/bm', routes(Lesson));
  }, 60000);
  beforeEach(async () => {
    await Lesson.deleteMany({});
    await Lesson.insertMany(seed);
  });
  afterAll(async () => {
    if (connection) {
      if (connection.readyState === 1) await connection.dropDatabase();
      await connection.close();
    }
    if (mongo) await mongo.stop();
  });

  test('legacy list includes placeholders, files, exact references and all lessons', async () => {
    const res = await request(app).get('/api/bm/lessons');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(seed.length);
    expect(titles(res.body)).toContain('Tag Storage');
    expect(res.body[0]).toMatchObject({
      author: author.toString(),
      relatedProject: project.toString(),
      allowedRoles: 'All',
    });
    expect(res.body[0].files[0].data).toEqual({
      type: 'Buffer',
      data: [...Buffer.from('file bytes')],
    });
  });
  test.each([
    ['tags=safety&tags=concrete', ['A']],
    ['tags=safety&tags=concrete&tagMatch=any', ['A', 'B', 'C', 'Tag Storage']],
    ['tags=safety&tags=safety', ['A', 'B', 'Tag Storage']],
    ['tags=Safety', []],
    ['tags=unknown', []],
    ['tags=&tags=%20', seed.map((doc) => doc.title)],
    ['tags=unknown&tags=water&tagMatch=any', ['C', 'D', 'G']],
  ])('database tag matching %s', async (query, expected) => {
    const res = await request(app).get(`/api/bm/lessons?${query}`);
    expect(res.status).toBe(200);
    expect(titles(res.body).sort()).toEqual([...expected].sort());
  });
  describe('supplied tag entry boundaries through the real Express parser', () => {
    const filterTags = Array.from({ length: 51 }, (_, i) => `tag${i}`);
    const serializeTags = (tags, format) => {
      const params = new URLSearchParams();
      tags.forEach((tag, index) => {
        let key = 'tags';
        if (format === 'brackets') key = 'tags[]';
        else if (format === 'indexed') key = `tags[${index}]`;
        params.append(key, tag);
      });
      return params.toString();
    };
    beforeEach(async () => {
      await Lesson.deleteMany({});
      await Lesson.insertMany([
        { ...seed[0], title: 'All20', tags: filterTags.slice(0, 20) },
        { ...seed[1], title: 'One', tags: filterTags.slice(0, 1) },
        { ...seed[2], title: 'Other', tags: ['other'] },
      ]);
    });
    describe.each(['repeated', 'brackets', 'indexed'])('%s serialization', (format) => {
      test.each([19, 20, 21, 50, 51])('%i distinct supplied tags', async (length) => {
        const query = serializeTags(filterTags.slice(0, length), format);
        const res = await request(app).get(`/api/bm/lessons?${query}`);
        expect(res.status).toBe(length <= 20 ? 200 : 400);
        if (length <= 20) expect(titles(res.body)).toEqual(['All20']);
        else expect(res.body.error).toContain('20');
      });
      test.each(['all', 'any'])('exactly 20 tags with %s matching', async (tagMatch) => {
        const query = serializeTags(filterTags.slice(0, 20), format);
        const res = await request(app).get(`/api/bm/lessons?${query}&tagMatch=${tagMatch}`);
        expect(res.status).toBe(200);
        expect(titles(res.body).sort()).toEqual(tagMatch === 'all' ? ['All20'] : ['All20', 'One']);
      });
      test('21 identical entries cannot bypass the supplied-entry limit', async () => {
        const query = serializeTags(Array(21).fill(filterTags[0]), format);
        const res = await request(app).get(`/api/bm/lessons?${query}`);
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('20');
      });
    });
    test.each(['tags[name]=Safety', 'tags[20]=Safety', 'tags[0][name]=Safety', 'tags[$ne]=Safety'])(
      'malformed object-shaped parameters return a format error: %s', async (query) => {
        const res = await request(app).get(`/api/bm/lessons?${query}`);
        expect(res.status).toBe(400);
        expect(res.body.error).toBe(
          'tags must be a string or an array of strings. Use repeated unindexed parameters ' +
            '(tags=first&tags=second), with at most 20 supplied entries.',
        );
      },
    );
    test('Safety and safety stay distinct in filters and global occurrence counts', async () => {
      await Lesson.insertMany([
        { ...seed[3], title: 'Upper', tags: ['Safety'] },
        { ...seed[4], title: 'Lower', tags: ['safety'] },
        { ...seed[5], title: 'Tag Storage', tags: ['Safety', 'Safety'] },
      ]);
      const upper = await request(app).get('/api/bm/lessons?tags=Safety');
      const lower = await request(app).get('/api/bm/lessons?tags=safety');
      const both = await request(app).get('/api/bm/lessons?tags=Safety&tags=safety&tagMatch=all');
      const counts = await request(app).get('/api/bm/tags/counts');
      [upper, lower, both, counts].forEach((res) => expect(res.status).toBe(200));
      expect(titles(upper.body).sort()).toEqual(['Tag Storage', 'Upper']);
      expect(titles(lower.body)).toEqual(['Lower']);
      expect(both.body).toEqual([]);
      expect(counts.body.find(({ tag }) => tag === 'Safety')).toEqual({ tag: 'Safety', count: 3 });
      expect(counts.body.find(({ tag }) => tag === 'safety')).toEqual({ tag: 'safety', count: 1 });
    });
  });
  test('tag predicates and global frequencies use case-sensitive matching even with a case-insensitive collection default', async () => {
    const name = 'case_insensitive_lessons';
    await connection.db.createCollection(name, { collation: { locale: 'en', strength: 2 } });
    const Other = connection.model('caseInsensitiveLesson', Base.schema, name);
    await Other.insertMany([
      { ...seed[0], title: 'lower', tags: ['safety', 'safety'] },
      { ...seed[1], title: 'upper', tags: ['Safety'] },
    ]);
    const otherApp = express();
    otherApp.use('/api/bm', routes(Other));
    const res = await request(otherApp).get(
      '/api/bm/lessons?tags=Safety&sort=tagFrequency&limit=1',
    );
    expect(res.status).toBe(200);
    expect(titles(res.body.data)).toEqual(['upper']);
    expect(res.body.pagination.total).toBe(1);
    const ordinary = await request(otherApp).get('/api/bm/lessons?tags=safety&limit=1');
    expect(titles(ordinary.body.data)).toEqual(['lower']);
    expect(ordinary.body.pagination.total).toBe(1);
  });
  test('operator/regex-like tag values are literal', async () => {
    await Lesson.create({
      ...seed[0],
      _id: new mongoose.Types.ObjectId(),
      title: 'Literal',
      tags: ['$ne', '.*', 'a,b'],
    });
    const res = await request(app).get('/api/bm/lessons?tags=%24ne&tags=.%2A&tags=a%2Cb');
    expect(titles(res.body)).toEqual(['Literal']);
  });
  test.each([
    ['newest', ['G', 'F', 'Tag Storage', 'D', 'C', 'B', 'A']],
    ['oldest', ['A', 'B', 'C', 'D', 'Tag Storage', 'F', 'G']],
    ['likes', ['B', 'D', 'C', 'A', 'F', 'G', 'Tag Storage']],
    ['tagFrequency', ['G', 'C', 'A', 'D', 'Tag Storage', 'B', 'F']],
  ])('%s sort precedes pagination and is deterministic', async (sort, expected) => {
    const res = await request(app).get('/api/bm/lessons').query({ sort });
    expect(res.status).toBe(200);
    expect(titles(res.body)).toEqual(expected);
  });
  test('global counts include filtered-out lessons and duplicate tag occurrences', async () => {
    const res = await request(app).get('/api/bm/lessons?tags=concrete&sort=tagFrequency&limit=1');
    expect(res.status).toBe(200);
    // Outside the filter, D and G make water globally more frequent than safety.
    // Counting only A/C would incorrectly rank A first.
    expect(titles(res.body.data)).toEqual(['C']);
    expect(res.body.pagination).toEqual({
      page: 1,
      limit: 1,
      total: 2,
      totalPages: 2,
      hasNextPage: true,
    });
  });
  test('frequency aggregation serializes files/references exactly like find and leaks no score fields', async () => {
    const legacy = await request(app).get('/api/bm/lessons');
    const scored = await request(app).get('/api/bm/lessons?sort=tagFrequency');
    expect(scored.status).toBe(200);
    scored.body.forEach((doc) => {
      expect(doc).toEqual(legacy.body.find((other) => other._id === doc._id));
    });
  });
  test('pagination reports matching count, not whole collection count', async () => {
    const res = await request(app).get('/api/bm/lessons?tags=safety&sort=oldest&page=2&limit=2');
    expect(titles(res.body.data)).toEqual(['Tag Storage']);
    expect(res.body.pagination).toEqual({
      page: 2,
      limit: 2,
      total: 3,
      totalPages: 2,
      hasNextPage: false,
    });
  });
  test.each(['page=100', 'tags=unknown&page=1', 'tags=unknown&sort=tagFrequency&page=1'])(
    'empty paginated result: %s',
    async (query) => {
      const res = await request(app).get(`/api/bm/lessons?${query}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.pagination.hasNextPage).toBe(false);
      if (query.includes('unknown')) expect(res.body.pagination.total).toBe(0);
    },
  );
  test.each(['thisWeek', 'thisMonth', 'thisYear'])(
    '%s uses inclusive start and exclusive end in the requested timezone',
    async (dateFilter) => {
      const timeZone = 'America/Los_Angeles';
      const start = moment.tz(timeZone);
      if (dateFilter === 'thisWeek') start.startOf('day').subtract(start.day(), 'days');
      else start.startOf(dateFilter === 'thisMonth' ? 'month' : 'year');
      const units = { thisWeek: 'week', thisMonth: 'month', thisYear: 'year' };
      const end = start.clone().add(1, units[dateFilter]);
      await Lesson.deleteMany({});
      await Lesson.insertMany([
        { ...seed[0], title: 'before', date: new Date(start.valueOf() - 1) },
        { ...seed[1], title: 'start', date: start.toDate() },
        { ...seed[2], title: 'last', date: new Date(end.valueOf() - 1) },
        { ...seed[3], title: 'end', date: end.toDate() },
      ]);
      const res = await request(app)
        .get('/api/bm/lessons')
        .query({ dateFilter, timeZone, tags: 'safety', sort: 'oldest', page: '1', limit: '1' });
      expect(res.status).toBe(200);
      expect(titles(res.body.data)).toEqual(['start']);
      expect(res.body.pagination.total).toBe(1);
      const all = await request(app)
        .get('/api/bm/lessons')
        .query({ dateFilter, timeZone, sort: 'oldest' });
      expect(titles(all.body)).toEqual(['start', 'last']);
    },
  );
  test.each([
    'tags[$ne]=x',
    'dateFilter=custom',
    'sort=bad',
    'page=0',
    'limit=101',
    'timeZone=Invalid',
    'page=1&page=2',
  ])('invalid request %s returns 400', async (query) => {
    const res = await request(app).get(`/api/bm/lessons?${query}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual(expect.any(String));
  });
  describe('global lesson tag counts endpoint', () => {
    const expected = [
      { tag: 'water', count: 4 },
      { tag: 'safety', count: 3 },
      { tag: 'concrete', count: 2 },
    ];
    test('empty collection returns an empty array', async () => {
      await Lesson.deleteMany({});
      const res = await request(app).get('/api/bm/tags/counts');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
    test('counts shared tags across the full collection without exposing lesson data', async () => {
      const res = await request(app).get('/api/bm/tags/counts');
      expect(res.status).toBe(200);
      expect(res.body).toEqual(expected);
      res.body.forEach((entry) => expect(Object.keys(entry).sort()).toEqual(['count', 'tag']));
    });
    test('duplicate tag entries in one lesson count separately', async () => {
      await Lesson.deleteMany({});
      await Lesson.create(seed[6]);
      const res = await request(app).get('/api/bm/tags/counts');
      expect(res.body).toEqual([{ tag: 'water', count: 2 }]);
    });
    test('Tag Storage placeholder contributes to global counts', async () => {
      const before = await request(app).get('/api/bm/tags/counts');
      expect(before.body.find((entry) => entry.tag === 'safety').count).toBe(3);
      await Lesson.deleteOne({ title: 'Tag Storage' });
      const after = await request(app).get('/api/bm/tags/counts');
      expect(after.body.find((entry) => entry.tag === 'safety').count).toBe(2);
    });
    test('case and whitespace remain distinct with stable binary tag-name ties', async () => {
      await Lesson.deleteMany({});
      await Lesson.create({ ...seed[0], tags: ['beta', 'Alpha', 'Beta', 'alpha', ' Alpha '] });
      const first = await request(app).get('/api/bm/tags/counts');
      const second = await request(app).get('/api/bm/tags/counts');
      expect(first.body).toEqual(
        [' Alpha ', 'Alpha', 'Beta', 'alpha', 'beta'].map((tag) => ({ tag, count: 1 })),
      );
      expect(second.body).toEqual(first.body);
    });
    test('query parameters cannot accidentally scope global counts to a filtered page', async () => {
      const res = await request(app).get(
        '/api/bm/tags/counts?tags=unknown&dateFilter=thisMonth&limit=1',
      );
      expect(res.body).toEqual(expected);
    });
    test('the existing tags endpoint still returns sorted unique strings', async () => {
      const before = await request(app).get('/api/bm/tags');
      await request(app).get('/api/bm/tags/counts');
      const after = await request(app).get('/api/bm/tags');
      expect(before.status).toBe(200);
      expect(before.body).toEqual(['concrete', 'safety', 'water']);
      expect(after.body).toEqual(before.body);
    });
    test('count grouping remains case-sensitive on a collection with case-insensitive default collation', async () => {
      const name = 'tag_counts_case_insensitive';
      await connection.db.createCollection(name, { collation: { locale: 'en', strength: 2 } });
      const Other = connection.model('tagCountsCaseInsensitive', Base.schema, name);
      await Other.create({ ...seed[0], tags: ['Safety', 'safety', 'safety'] });
      const otherApp = express();
      otherApp.use('/api/bm', routes(Other));
      const res = await request(otherApp).get('/api/bm/tags/counts');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([
        { tag: 'safety', count: 2 },
        { tag: 'Safety', count: 1 },
      ]);
    });
    test('database failure returns a safe HTTP 500', async () => {
      const spy = jest.spyOn(Lesson, 'aggregate').mockImplementation(() => {
        throw new Error('private database details');
      });
      try {
        const res = await request(app).get('/api/bm/tags/counts');
        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: 'Failed to fetch lesson tag counts.' });
      } finally {
        spy.mockRestore();
      }
    });
  });
});
