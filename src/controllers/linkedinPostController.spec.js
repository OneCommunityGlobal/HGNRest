jest.mock('axios');
jest.mock('node-schedule', () => ({
  scheduleJob: jest.fn(),
}));

const axios = require('axios');
const schedule = require('node-schedule');
const linkedinPostController = require('./linkedinPostController');

const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
});

describe('linkedinPostController', () => {
  const envKeys = ['LINKEDIN_POSTING_ENABLED', 'ORGANIZATION_URN', 'LINKEDIN_ACCESS_TOKEN'];
  const originalEnv = Object.fromEntries(
    envKeys.map((key) => [
      key,
      {
        exists: Object.prototype.hasOwnProperty.call(process.env, key),
        value: process.env[key],
      },
    ]),
  );

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.LINKEDIN_POSTING_ENABLED = 'true';
    process.env.ORGANIZATION_URN = 'urn:li:organization:123';
    process.env.LINKEDIN_ACCESS_TOKEN = 'test-token';
    schedule.scheduleJob.mockReturnValue({
      cancel: jest.fn(),
    });
  });

  afterEach(() => {
    envKeys.forEach((key) => {
      if (originalEnv[key].exists) {
        process.env[key] = originalEnv[key].value;
      } else {
        delete process.env[key];
      }
    });
  });

  const expectPostingDisabled = (res) => {
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      code: 'LINKEDIN_POSTING_DISABLED',
      message: 'LinkedIn posting is disabled in this environment.',
    });
    expect(axios.post).not.toHaveBeenCalled();
    expect(axios.put).not.toHaveBeenCalled();
  };

  test('does not post when LINKEDIN_POSTING_ENABLED is missing', async () => {
    delete process.env.LINKEDIN_POSTING_ENABLED;
    const controller = linkedinPostController();
    const req = { body: { content: 'Do not post' }, files: [] };
    const res = makeRes();

    await controller.postToLinkedin(req, res);

    expectPostingDisabled(res);
  });

  test('does not post when LINKEDIN_POSTING_ENABLED is false', async () => {
    process.env.LINKEDIN_POSTING_ENABLED = 'false';
    const controller = linkedinPostController();
    const req = { body: { content: 'Do not post' }, files: [] };
    const res = makeRes();

    await controller.postToLinkedin(req, res);

    expectPostingDisabled(res);
  });

  test('returns the configuration error when enabled without ORGANIZATION_URN', async () => {
    delete process.env.ORGANIZATION_URN;
    const controller = linkedinPostController();
    const req = { body: { content: 'Configured post' }, files: [] };
    const res = makeRes();

    await controller.postToLinkedin(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Missing required environment variables.' }),
    );
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('returns the configuration error when enabled without LINKEDIN_ACCESS_TOKEN', async () => {
    delete process.env.LINKEDIN_ACCESS_TOKEN;
    const controller = linkedinPostController();
    const req = { body: { content: 'Configured post' }, files: [] };
    const res = makeRes();

    await controller.postToLinkedin(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Missing required environment variables.' }),
    );
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('returns 400 when content is missing', async () => {
    const controller = linkedinPostController();
    const req = { body: {}, files: [] };
    const res = makeRes();

    await controller.postToLinkedin(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Content is required' }),
    );
  });

  test('returns 400 when schedule time is in the past', async () => {
    const controller = linkedinPostController();
    const req = {
      body: {
        content: 'Hello LinkedIn',
        scheduleTime: new Date(Date.now() - 60_000).toISOString(),
      },
      files: [],
    };
    const res = makeRes();

    await controller.postToLinkedin(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Schedule time must be in the future' }),
    );
  });

  test('publishes immediately when no schedule time is provided', async () => {
    const controller = linkedinPostController();
    const req = {
      body: {
        content: 'Ship it',
      },
      files: [],
    };
    const res = makeRes();

    axios.post.mockResolvedValue({ data: { id: 'ugc-post-1' } });

    await controller.postToLinkedin(req, res);

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenCalledWith(
      'https://api.linkedin.com/v2/ugcPosts',
      expect.objectContaining({
        author: 'urn:li:organization:123',
      }),
      expect.any(Object),
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('rejects untrusted LinkedIn upload URLs before uploading media', async () => {
    const controller = linkedinPostController();
    const req = {
      body: {
        content: 'Ship it safely',
      },
      files: [
        {
          buffer: Buffer.from('image-bytes'),
          mimetype: 'image/png',
          originalname: 'test.png',
          size: 11,
        },
      ],
    };
    const res = makeRes();

    axios.post.mockResolvedValueOnce({
      data: {
        value: {
          uploadMechanism: {
            'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': {
              uploadUrl: 'https://example.com/upload',
            },
          },
          asset: 'urn:li:digitalmediaAsset:123',
        },
      },
    });

    await controller.postToLinkedin(req, res);

    expect(axios.put).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Failed to post to LinkedIn',
        error: 'Received an invalid LinkedIn upload URL',
      }),
    );
  });

  test('schedules, lists, updates, and deletes a scheduled post', async () => {
    const cancel = jest.fn();
    schedule.scheduleJob.mockReturnValueOnce({ cancel }).mockReturnValueOnce({ cancel: jest.fn() });

    const controller = linkedinPostController();
    const createReq = {
      body: {
        content: 'Original content',
        scheduleTime: new Date(Date.now() + 60_000).toISOString(),
      },
      files: [],
    };
    const createRes = makeRes();

    await controller.postToLinkedin(createReq, createRes);

    const createdJobId = createRes.json.mock.calls[0][0].jobId;

    const listRes = makeRes();
    controller.getScheduledPosts({}, listRes);
    expect(listRes.status).toHaveBeenCalledWith(200);
    expect(listRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduledPosts: [
          expect.objectContaining({
            jobId: createdJobId,
            content: 'Original content',
          }),
        ],
      }),
    );

    const updateRes = makeRes();
    controller.updateScheduledPost(
      {
        params: { jobId: createdJobId },
        body: {
          content: 'Updated content',
          scheduleTime: new Date(Date.now() + 120_000).toISOString(),
        },
        files: [],
      },
      updateRes,
    );
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(updateRes.status).toHaveBeenCalledWith(200);

    const deleteRes = makeRes();
    controller.deleteScheduledPost({ params: { jobId: createdJobId } }, deleteRes);
    expect(deleteRes.status).toHaveBeenCalledWith(200);
  });

  test('does not execute an existing scheduled post after posting is disabled', async () => {
    let scheduledCallback;
    schedule.scheduleJob.mockImplementationOnce((scheduledDateTime, callback) => {
      scheduledCallback = callback;
      return { cancel: jest.fn() };
    });
    const controller = linkedinPostController();
    const createRes = makeRes();

    await controller.postToLinkedin(
      {
        body: {
          content: 'Scheduled content',
          scheduleTime: new Date(Date.now() + 60_000).toISOString(),
        },
        files: [],
      },
      createRes,
    );

    process.env.LINKEDIN_POSTING_ENABLED = 'false';
    await scheduledCallback();

    expect(axios.post).not.toHaveBeenCalled();
    const listRes = makeRes();
    controller.getScheduledPosts({}, listRes);
    expect(listRes.json).toHaveBeenCalledWith({
      success: true,
      scheduledPosts: [
        expect.objectContaining({
          content: 'Scheduled content',
        }),
      ],
    });
  });

  test('does not update a scheduled post after posting is disabled', async () => {
    const controller = linkedinPostController();
    const createRes = makeRes();
    await controller.postToLinkedin(
      {
        body: {
          content: 'Scheduled content',
          scheduleTime: new Date(Date.now() + 60_000).toISOString(),
        },
        files: [],
      },
      createRes,
    );
    const [{ jobId }] = createRes.json.mock.calls[0];

    process.env.LINKEDIN_POSTING_ENABLED = 'false';
    const updateRes = makeRes();
    controller.updateScheduledPost(
      {
        params: { jobId },
        body: { content: 'Updated content' },
        files: [],
      },
      updateRes,
    );

    expectPostingDisabled(updateRes);
    expect(schedule.scheduleJob).toHaveBeenCalledTimes(1);
  });
});
