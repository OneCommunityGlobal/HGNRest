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
  const originalOrganizationUrn = process.env.ORGANIZATION_URN;
  const originalAccessToken = process.env.LINKEDIN_ACCESS_TOKEN;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ORGANIZATION_URN = 'urn:li:organization:123';
    process.env.LINKEDIN_ACCESS_TOKEN = 'test-token';
    schedule.scheduleJob.mockReturnValue({
      cancel: jest.fn(),
    });
  });

  afterAll(() => {
    process.env.ORGANIZATION_URN = originalOrganizationUrn;
    process.env.LINKEDIN_ACCESS_TOKEN = originalAccessToken;
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
});
