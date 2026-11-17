jest.mock('../../../startup/logger', () => ({ logException: jest.fn() }));
jest.mock('../../../config', () => ({ JWT_SECRET: require('crypto').randomBytes(32).toString('hex') }));
// The global middleware also imports an unrelated PayPal handler. Never initialize its services.
jest.mock('../../lbdashboard/webhookController', () => () => ({ webhookTest: jest.fn() }));
const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { JWT_SECRET } = require('../../../config');
const middleware = require('../../../startup/middleware');
const Lesson = require('../../../models/bmdashboard/buildingNewLesson');
const Like = require('../../../models/bmdashboard/buldingLessonLike');
const routes = require('../../../routes/bmdashboard/bmNewLessonRouter');

// Real JWT middleware, real models and an exclusively disposable MongoDB connection.
describe('authenticated lesson isLiked readback', () => {
  let mongo;
  let app;
  let lessons;
  const user = new mongoose.Types.ObjectId();
  const otherUser = new mongoose.Types.ObjectId();
  const project = new mongoose.Types.ObjectId();
  const token = jwt.sign({
    userid: String(user),
    role: 'Administrator',
    expiryTimestamp: new Date(Date.now() + 3600000).toISOString(),
  }, JWT_SECRET, { expiresIn: '1h' });
  const get = (query = '') => request(app).get(`/api/bm/lessons${query}`).set('Authorization', token);
  const flags = (body) => Object.fromEntries(body.map((lesson) => [lesson.title, lesson.isLiked]));

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create({ instance: { ip: '127.0.0.1', dbName: 'lesson_liked_disposable' } });
    const uri = mongo.getUri('lesson_liked_disposable');
    expect(uri).toMatch(/^mongodb:\/\/127\.0\.0\.1:/);
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false, autoIndex: false });
    app = express();
    middleware(app);
    app.use('/api/bm', routes(Lesson));
  });
  beforeEach(async () => {
    await Like.deleteMany({});
    await Lesson.deleteMany({});
    lessons = await Lesson.create(['A', 'B', 'C'].map((title, i) => ({
      title, content: 'Original content', date: new Date(Date.UTC(2024, 0, i + 1)),
      author: user, relatedProject: project, tags: i === 2 ? ['water'] : ['safety', 'water'],
      allowedRoles: 'All', files: [{ data: Buffer.from('fixture'), contentType: 'text/plain', filename: 'file.txt' }],
    })));
    const likes = await Like.create([
      { user, lesson: lessons[0]._id },
      { user: otherUser, lesson: lessons[1]._id },
      { user, lesson: lessons[2]._id },
    ]);
    await Promise.all(lessons.map((lesson, i) => Lesson.updateOne({ _id: lesson._id }, {
      $set: { likes: [likes[i]._id], totalLikes: 1 },
    })));
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    if (mongo) await mongo.stop();
  });

  test('legacy array retains all serialized fields and adds true/false from Like records', async () => {
    const original = JSON.parse(JSON.stringify(await Lesson.find({})));
    const res = await get();
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(flags(res.body)).toEqual({ A: true, B: false, C: true });
    expect(res.body.map(({ isLiked, ...lesson }) => lesson)).toEqual(original);
  });
  test.each(['newest', 'oldest', 'likes', 'tagFrequency'])(
    '%s filtering retains personalized flags and hydrated file buffers', async (sort) => {
      const res = await get(`?tags=safety&sort=${sort}`);
      expect(res.status).toBe(200);
      expect(flags(res.body)).toEqual({ A: true, B: false });
      expect(res.body[0].files[0].data).toEqual({ type: 'Buffer', data: [...Buffer.from('fixture')] });
    },
  );
  test.each(['newest', 'tagFrequency'])('%s pagination batches only returned IDs in one lookup', async (sort) => {
    const find = jest.spyOn(Like, 'find');
    const res = await get(`?sort=${sort}&page=2&limit=1`);
    expect(res.status).toBe(200);
    expect(res.body.pagination).toEqual({ page: 2, limit: 1, total: 3, totalPages: 3, hasNextPage: true });
    expect(res.body.data).toHaveLength(1);
    const lesson = res.body.data[0];
    expect(lesson.isLiked).toBe(lesson.title !== 'B');
    expect(find).toHaveBeenCalledTimes(1);
    const filter = find.mock.calls[0][0];
    expect(filter.user).toBe(String(user));
    expect(filter.lesson.$in.map(String)).toEqual([lesson._id]);
  });
  test('non-paginated multiple lessons use one projected lookup, never N+1', async () => {
    const find = jest.spyOn(Like, 'find');
    const res = await get();
    expect(res.status).toBe(200);
    expect(find).toHaveBeenCalledTimes(1);
    expect(find.mock.calls[0][0].lesson.$in).toHaveLength(3);
  });
  test('query and body user IDs cannot override the authenticated identity', async () => {
    const res = await get(`?userId=${otherUser}&requestorId=${otherUser}`)
      .send({ user: { requestorId: String(otherUser) }, requestor: { requestorId: String(otherUser) } });
    expect(res.status).toBe(200);
    expect(flags(res.body)).toEqual({ A: true, B: false, C: true });
  });
  test('a different valid JWT gets that user\'s flags', async () => {
    const otherToken = jwt.sign({ userid: String(otherUser), role: 'Volunteer', expiryTimestamp: new Date(Date.now() + 3600000).toISOString() }, JWT_SECRET);
    const res = await request(app).get('/api/bm/lessons').set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(200);
    expect(flags(res.body)).toEqual({ A: false, B: true, C: false });
  });
  test.each(['', '?page=2'])('empty results skip the Like lookup (%s)', async (pagination) => {
    const find = jest.spyOn(Like, 'find');
    const res = await get(`?tags=unknown${pagination.replace('?', '&')}`);
    expect(res.status).toBe(200);
    expect(pagination ? res.body.data : res.body).toEqual([]);
    expect(find).not.toHaveBeenCalled();
  });
  test.each([undefined, 'invalid-token'])('unauthenticated/invalid JWT is rejected before lookup (%s)', async (authorization) => {
    const find = jest.spyOn(Like, 'find');
    const req = request(app).get('/api/bm/lessons');
    if (authorization) req.set('Authorization', authorization);
    const res = await req;
    expect(res.status).toBe(401);
    expect(find).not.toHaveBeenCalled();
  });
  test('Like lookup failure returns a safe 500 instead of incorrect false flags', async () => {
    jest.spyOn(Like, 'find').mockReturnValue({ select: () => ({ lean: () => Promise.reject(new Error('private database details')) }) });
    const res = await get();
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Failed to fetch lessons.' });
  });
  test('real unlike/like is reflected by subsequent GET without changing PUT responses', async () => {
    const url = `/api/bm/lesson/${lessons[0]._id}/like`;
    let res = await request(app).put(url).set('Authorization', token).send({ userId: String(user) });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'success', message: 'Lesson unliked successfully' });
    expect(flags((await get()).body).A).toBe(false);
    res = await request(app).put(url).set('Authorization', token).send({ userId: String(user) });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'success', message: 'Lesson liked successfully' });
    expect(flags((await get()).body).A).toBe(true);
  });
});
