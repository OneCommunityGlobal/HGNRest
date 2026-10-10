jest.mock('axios');

const axios = require('axios');
const {
  createMediaContainer,
  waitForContainerReady,
  publishMediaContainer,
  getMediaDetails,
  publishInstagramPost,
} = require('../instagramServices');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('createMediaContainer', () => {
  it('creates an IMAGE container', async () => {
    axios.post.mockResolvedValue({ data: { id: 'container1' } });

    const result = await createMediaContainer({
      instagramAccountId: 'acct123',
      accessToken: 'token-abc',
      caption: 'hello',
      mediaUrl: 'https://cdn.example.com/photo.jpg',
      mediaType: 'IMAGE',
    });

    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/acct123/media'),
      null,
      expect.objectContaining({
        params: expect.objectContaining({ image_url: 'https://cdn.example.com/photo.jpg' }),
      }),
    );
    expect(result).toEqual({ id: 'container1' });
  });

  it('creates a VIDEO container as REELS', async () => {
    axios.post.mockResolvedValue({ data: { id: 'container2' } });

    await createMediaContainer({
      instagramAccountId: 'acct123',
      accessToken: 'token-abc',
      caption: 'a reel',
      mediaUrl: 'https://cdn.example.com/clip.mp4',
      mediaType: 'VIDEO',
    });

    expect(axios.post).toHaveBeenCalledWith(
      expect.any(String),
      null,
      expect.objectContaining({
        params: expect.objectContaining({
          media_type: 'REELS',
          video_url: 'https://cdn.example.com/clip.mp4',
        }),
      }),
    );
  });

  it('rejects an invalid instagramAccountId', async () => {
    await expect(
      createMediaContainer({
        instagramAccountId: 'bad id!',
        accessToken: 'token-abc',
        caption: 'hi',
        mediaUrl: 'https://cdn.example.com/photo.jpg',
        mediaType: 'IMAGE',
      }),
    ).rejects.toThrow(/Invalid instagramAccountId/);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('rejects a malformed mediaUrl', async () => {
    await expect(
      createMediaContainer({
        instagramAccountId: 'acct123',
        accessToken: 'token-abc',
        caption: 'hi',
        mediaUrl: 'not-a-url',
        mediaType: 'IMAGE',
      }),
    ).rejects.toThrow(/Invalid mediaUrl/);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('rejects a non-https mediaUrl', async () => {
    await expect(
      createMediaContainer({
        instagramAccountId: 'acct123',
        accessToken: 'token-abc',
        caption: 'hi',
        mediaUrl: 'http://cdn.example.com/photo.jpg',
        mediaType: 'IMAGE',
      }),
    ).rejects.toThrow(/mediaUrl must be https/);
    expect(axios.post).not.toHaveBeenCalled();
  });
});

describe('waitForContainerReady', () => {
  it('resolves true when status is FINISHED', async () => {
    axios.get.mockResolvedValue({ data: { status_code: 'FINISHED' } });

    await expect(
      waitForContainerReady({ creationId: 'container1', accessToken: 'token-abc' }),
    ).resolves.toBe(true);
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  it('retries while IN_PROGRESS and then resolves', async () => {
    axios.get
      .mockResolvedValueOnce({ data: { status_code: 'IN_PROGRESS' } })
      .mockResolvedValueOnce({ data: { status_code: 'FINISHED' } });

    await expect(
      waitForContainerReady({ creationId: 'container1', accessToken: 'token-abc', delayMs: 1 }),
    ).resolves.toBe(true);
    expect(axios.get).toHaveBeenCalledTimes(2);
  });

  it('throws when status is ERROR', async () => {
    axios.get.mockResolvedValue({ data: { status_code: 'ERROR' } });

    await expect(
      waitForContainerReady({ creationId: 'container1', accessToken: 'token-abc' }),
    ).rejects.toThrow('Instagram media processing failed.');
  });

  it('throws after exceeding maxAttempts', async () => {
    axios.get.mockResolvedValue({ data: { status_code: 'IN_PROGRESS' } });

    await expect(
      waitForContainerReady({
        creationId: 'container1',
        accessToken: 'token-abc',
        maxAttempts: 2,
        delayMs: 1,
      }),
    ).rejects.toThrow('Instagram media was not ready in time.');
    expect(axios.get).toHaveBeenCalledTimes(2);
  });

  it('rejects an invalid creationId', async () => {
    await expect(
      waitForContainerReady({ creationId: '', accessToken: 'token-abc' }),
    ).rejects.toThrow(/Invalid creationId/);
    expect(axios.get).not.toHaveBeenCalled();
  });
});

describe('publishMediaContainer', () => {
  it('publishes a container and returns the response data', async () => {
    axios.post.mockResolvedValue({ data: { id: 'media1' } });

    const result = await publishMediaContainer({
      instagramAccountId: 'acct123',
      accessToken: 'token-abc',
      creationId: 'container1',
    });

    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/acct123/media_publish'),
      null,
      expect.objectContaining({
        params: { creation_id: 'container1', access_token: 'token-abc' },
      }),
    );
    expect(result).toEqual({ id: 'media1' });
  });

  it('rejects an invalid creationId', async () => {
    await expect(
      publishMediaContainer({
        instagramAccountId: 'acct123',
        accessToken: 'token-abc',
        creationId: 'bad id!',
      }),
    ).rejects.toThrow(/Invalid creationId/);
    expect(axios.post).not.toHaveBeenCalled();
  });
});

describe('getMediaDetails', () => {
  it('fetches media details and returns the response data', async () => {
    axios.get.mockResolvedValue({
      data: { id: 'media1', permalink: 'https://instagram.com/p/media1', media_type: 'IMAGE' },
    });

    const result = await getMediaDetails({ mediaId: 'media1', accessToken: 'token-abc' });

    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining('/media1'),
      expect.objectContaining({
        params: { fields: 'id,permalink,media_type,timestamp', access_token: 'token-abc' },
      }),
    );
    expect(result.permalink).toBe('https://instagram.com/p/media1');
  });

  it('rejects an invalid mediaId', async () => {
    await expect(getMediaDetails({ mediaId: null, accessToken: 'token-abc' })).rejects.toThrow(
      /Invalid mediaId/,
    );
    expect(axios.get).not.toHaveBeenCalled();
  });
});

describe('publishInstagramPost', () => {
  const input = {
    instagramAccountId: 'acct123',
    accessToken: 'token-abc',
    caption: 'hello world',
    mediaUrl: 'https://cdn.example.com/photo.jpg',
    mediaType: 'IMAGE',
  };

  it('runs the full flow and returns the assembled result', async () => {
    axios.post
      .mockResolvedValueOnce({ data: { id: 'container1' } }) // createMediaContainer
      .mockResolvedValueOnce({ data: { id: 'media1' } }); // publishMediaContainer
    axios.get
      .mockResolvedValueOnce({ data: { status_code: 'FINISHED' } }) // waitForContainerReady
      .mockResolvedValueOnce({
        data: { id: 'media1', permalink: 'https://instagram.com/p/media1', media_type: 'IMAGE' },
      }); // getMediaDetails

    const result = await publishInstagramPost(input);

    expect(result).toEqual({
      creationId: 'container1',
      instagramMediaId: 'media1',
      permalink: 'https://instagram.com/p/media1',
      mediaType: 'IMAGE',
    });
  });

  it('falls back to permalink: null and the input mediaType when missing from media details', async () => {
    axios.post
      .mockResolvedValueOnce({ data: { id: 'container1' } })
      .mockResolvedValueOnce({ data: { id: 'media1' } });
    axios.get
      .mockResolvedValueOnce({ data: { status_code: 'FINISHED' } })
      .mockResolvedValueOnce({ data: { id: 'media1' } }); // no permalink/media_type

    const result = await publishInstagramPost({ ...input, mediaType: 'VIDEO' });

    expect(result.permalink).toBeNull();
    expect(result.mediaType).toBe('VIDEO');
  });

  it('throws if no creation ID is returned', async () => {
    axios.post.mockResolvedValueOnce({ data: {} });

    await expect(publishInstagramPost(input)).rejects.toThrow(
      'Instagram did not return a creation ID.',
    );
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('throws if no media ID is returned after publishing', async () => {
    axios.post
      .mockResolvedValueOnce({ data: { id: 'container1' } })
      .mockResolvedValueOnce({ data: {} });
    axios.get.mockResolvedValueOnce({ data: { status_code: 'FINISHED' } });

    await expect(publishInstagramPost(input)).rejects.toThrow(
      'Instagram did not return a media ID.',
    );
  });

  it('propagates an error if container processing fails', async () => {
    axios.post.mockResolvedValueOnce({ data: { id: 'container1' } });
    axios.get.mockResolvedValueOnce({ data: { status_code: 'ERROR' } });

    await expect(publishInstagramPost(input)).rejects.toThrow('Instagram media processing failed.');
  });
});
