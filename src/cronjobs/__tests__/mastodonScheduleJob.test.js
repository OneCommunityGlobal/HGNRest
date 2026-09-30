jest.mock('axios', () => ({ post: jest.fn() }));
jest.mock('node-cron', () => ({ schedule: jest.fn() }));
jest.mock('../../models/mastodonSchedule', () => ({ find: jest.fn(), deleteOne: jest.fn() }));
jest.mock('../../controllers/mastodonPostController', () => ({ uploadMedia: jest.fn() }));

describe('mastodonScheduleJob', () => {
  let axios;
  let cron;
  let MastodonSchedule;
  let job;

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

  it('posts due posts and removes them from the schedule', async () => {
    MastodonSchedule.find.mockResolvedValue([
      { _id: 'p1', postData: JSON.stringify({ status: 'Due post', visibility: 'public' }) },
    ]);
    axios.post.mockResolvedValue({ data: {} });
    MastodonSchedule.deleteOne.mockResolvedValue({ deletedCount: 1 });

    await job.processScheduledPosts();

    expect(MastodonSchedule.find).toHaveBeenCalledWith({
      scheduledTime: { $lte: expect.any(Date) },
    });
    expect(axios.post).toHaveBeenCalledWith(
      'https://mastodon.example/api/v1/statuses',
      { status: 'Due post', visibility: 'public' },
      expect.objectContaining({ headers: { Authorization: 'Bearer test-token' } }),
    );
    expect(MastodonSchedule.deleteOne).toHaveBeenCalledWith({ _id: 'p1' });
  });

  it('keeps a post in the schedule when posting fails', async () => {
    MastodonSchedule.find.mockResolvedValue([
      { _id: 'p2', postData: JSON.stringify({ status: 'Will fail' }) },
    ]);
    axios.post.mockRejectedValue(new Error('Mastodon down'));

    await job.processScheduledPosts();

    expect(MastodonSchedule.deleteOne).not.toHaveBeenCalled();
  });
});
