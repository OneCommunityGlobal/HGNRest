jest.mock('axios', () => ({ post: jest.fn() }));
jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('../../models/mastodonSchedule', () => ({
  findOneAndUpdate: jest.fn(),
  updateOne: jest.fn(),
  updateMany: jest.fn(),
}));
jest.mock('../../controllers/mastodonPostController', () => ({ uploadMedia: jest.fn() }));

// In-memory stand-in for the schedule collection. Each update runs to
// completion before another starts, like a single-document MongoDB update.
function matchesCondition(value, condition) {
  if (condition && typeof condition === 'object' && !(condition instanceof Date)) {
    return Object.entries(condition).every(([op, expected]) => {
      if (op === '$in') return expected.some((e) => (e === null ? value == null : value === e));
      if (op === '$nin') return !expected.includes(value);
      if (op === '$ne') return value !== expected;
      if (op === '$lte') return value <= expected;
      if (op === '$lt') return value < expected;
      throw new Error(`Unsupported operator ${op}`);
    });
  }
  return value === condition;
}

function matches(doc, filter) {
  return Object.entries(filter).every(([key, condition]) => matchesCondition(doc[key], condition));
}

function applyUpdate(doc, update) {
  Object.assign(doc, update.$set);
  Object.keys(update.$unset || {}).forEach((key) => delete doc[key]);
  Object.entries(update.$inc || {}).forEach(([key, n]) => {
    doc[key] = (doc[key] || 0) + n;
  });
}

function createStore(docs) {
  return {
    docs,
    findOneAndUpdate: async (filter, update, options) => {
      const due = docs
        .filter((doc) => matches(doc, filter))
        .sort((a, b) => a.scheduledTime - b.scheduledTime);
      if (!due.length) return null;
      applyUpdate(due[0], update);
      return options?.new ? { ...due[0] } : null;
    },
    updateOne: async (filter, update) => {
      const doc = docs.find((d) => matches(d, filter));
      if (doc) applyUpdate(doc, update);
      return { nModified: doc ? 1 : 0 };
    },
    updateMany: async (filter, update) => {
      const found = docs.filter((d) => matches(d, filter));
      found.forEach((doc) => applyUpdate(doc, update));
      return { nModified: found.length };
    },
  };
}

function duePost(overrides = {}) {
  return {
    _id: 'p1',
    postData: JSON.stringify({ status: 'Due post', visibility: 'public' }),
    scheduledTime: new Date(Date.now() - 60 * 1000),
    status: 'pending',
    ...overrides,
  };
}

describe('mastodonScheduleJob', () => {
  let axios;
  let cron;
  let MastodonSchedule;
  let job;
  let store;

  function useStore(docs) {
    store = createStore(docs);
    MastodonSchedule.findOneAndUpdate.mockImplementation(store.findOneAndUpdate);
    MastodonSchedule.updateOne.mockImplementation(store.updateOne);
    MastodonSchedule.updateMany.mockImplementation(store.updateMany);
  }

  beforeEach(() => {
    jest.resetModules();
    process.env.MASTODON_ACCESS_TOKEN = 'test-token';
    process.env.MASTODON_ENDPOINT = 'https://mastodon.example';
    axios = require('axios');
    cron = require('node-cron');
    MastodonSchedule = require('../../models/mastodonSchedule');
    job = require('../mastodonScheduleJob');
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.MASTODON_ACCESS_TOKEN;
    delete process.env.MASTODON_ENDPOINT;
  });

  it('schedules the job to run every minute', () => {
    job.startMastodonScheduleJob();
    expect(cron.schedule).toHaveBeenCalledWith('* * * * *', job.processScheduledPosts);
  });

  it('posts a due post once with an idempotency key and records it as posted', async () => {
    useStore([duePost()]);
    axios.post.mockResolvedValue({ data: { id: '109' } });

    await job.processScheduledPosts();

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenCalledWith(
      'https://mastodon.example/api/v1/statuses',
      { status: 'Due post', visibility: 'public' },
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer test-token',
          'Idempotency-Key': 'hgn-mastodon-schedule-p1',
        },
      }),
    );
    expect(store.docs[0]).toMatchObject({ status: 'posted', remoteStatusId: '109' });
    expect(store.docs[0].lockOwner).toBeUndefined();

    await job.processScheduledPosts();
    expect(axios.post).toHaveBeenCalledTimes(1);
  });

  it('treats records saved without a status as pending', async () => {
    const legacy = duePost();
    delete legacy.status;
    useStore([legacy]);
    axios.post.mockResolvedValue({ data: { id: '1' } });

    await job.processScheduledPosts();

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(store.docs[0].status).toBe('posted');
  });

  it('publishes once when the minute callback runs again while a post is in flight', async () => {
    useStore([duePost()]);
    let finishFirstPost;
    axios.post.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishFirstPost = () => resolve({ data: { id: '1' } });
        }),
    );
    axios.post.mockResolvedValue({ data: { id: '2' } });

    job.startMastodonScheduleJob();
    const minuteCallback = cron.schedule.mock.calls[0][1];

    const firstRun = minuteCallback(new Date());
    await new Promise(setImmediate);
    expect(axios.post).toHaveBeenCalledTimes(1);

    await minuteCallback(new Date());
    finishFirstPost();
    await firstRun;

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(store.docs[0].status).toBe('posted');
  });

  it('publishes once when two workers process the same due post', async () => {
    useStore([duePost()]);
    axios.post.mockResolvedValue({ data: { id: '1' } });

    await Promise.all([
      job.processScheduledPosts({ workerId: 'server-a' }),
      job.processScheduledPosts({ workerId: 'server-b' }),
    ]);

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(store.docs[0].status).toBe('posted');
  });

  it('does not republish when Mastodon accepts the post but recording it fails', async () => {
    useStore([duePost()]);
    axios.post.mockResolvedValue({ data: { id: '1' } });
    MastodonSchedule.updateOne.mockRejectedValueOnce(new Error('database unavailable'));

    await job.processScheduledPosts();
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(store.docs[0].status).toBe('publishing');

    // Later run while the claim is still held
    await job.processScheduledPosts();
    expect(axios.post).toHaveBeenCalledTimes(1);

    // Run after the claim has expired
    store.docs[0].lockedUntil = new Date(Date.now() - 1000);
    await job.processScheduledPosts();
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(store.docs[0].status).toBe('failed');
  });

  it('retries a post that Mastodon rejected with a server error', async () => {
    useStore([duePost()]);
    axios.post.mockRejectedValueOnce(
      Object.assign(new Error('Server error'), { response: { status: 503, data: {} } }),
    );
    axios.post.mockResolvedValue({ data: { id: '1' } });

    await job.processScheduledPosts();
    expect(store.docs[0].status).toBe('pending');

    await job.processScheduledPosts();
    expect(axios.post).toHaveBeenCalledTimes(2);
    expect(axios.post.mock.calls[1][2].headers['Idempotency-Key']).toBe('hgn-mastodon-schedule-p1');
    expect(store.docs[0].status).toBe('posted');
  });

  it('does not retry when the request times out, since the post may have gone through', async () => {
    useStore([duePost()]);
    axios.post.mockRejectedValue(new Error('timeout of 30000ms exceeded'));

    await job.processScheduledPosts();
    await job.processScheduledPosts();

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(store.docs[0].status).toBe('failed');
  });

  it('stops retrying after the maximum number of attempts', async () => {
    useStore([duePost()]);
    axios.post.mockRejectedValue(
      Object.assign(new Error('Server error'), { response: { status: 500, data: {} } }),
    );

    await job.processScheduledPosts();
    await job.processScheduledPosts();
    await job.processScheduledPosts();
    await job.processScheduledPosts();

    expect(axios.post).toHaveBeenCalledTimes(3);
    expect(store.docs[0].status).toBe('failed');
  });

  it('does not post scheduled posts that are not due yet', async () => {
    useStore([duePost({ scheduledTime: new Date(Date.now() + 60 * 60 * 1000) })]);

    await job.processScheduledPosts();

    expect(axios.post).not.toHaveBeenCalled();
    expect(store.docs[0].status).toBe('pending');
  });
});
