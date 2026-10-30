const nock = require('nock');
const linkedinPostController = require('./linkedinPostController');

// Exercise the actual Axios HTTP adapter; all HTTP is intercepted, with network fallback disabled.
describe('LinkedIn upload transport boundary', () => {
  const originalEnv = { ...process.env };
  const uploadPath =
    '/dms-uploads/C5622AQHdBDflPp0pEg/feedshare-uploadedImage/0?ut=signed%2Bvalue%3D';
  let res;
  let errors;

  beforeEach(() => {
    process.env.LINKEDIN_ACCESS_TOKEN = 'TRANSPORT_PRIVATE_SENTINEL';
    process.env.ORGANIZATION_URN = 'urn:li:organization:123';
    process.env.NO_PROXY = '*';
    nock.disableNetConnect();
    errors = jest.spyOn(console, 'error').mockImplementation(() => {});
    res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  const registerUpload = () =>
    nock('https://api.linkedin.com')
      .post('/v2/assets?action=registerUpload')
      .reply(200, {
        value: {
          asset: 'urn:li:digitalmediaAsset:123',
          uploadMechanism: {
            'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': {
              uploadUrl: `https://www.linkedin.com${uploadPath}`,
            },
          },
        },
      });

  const publish = () =>
    linkedinPostController().postToLinkedin(
      {
        body: { content: 'test image' },
        files: [{ buffer: Buffer.from('image bytes'), mimetype: 'image/png' }],
      },
      res,
    );

  it('preserves signed upload paths and sends the image before creating the post', async () => {
    const registration = registerUpload();
    const upload = nock('https://www.linkedin.com', {
      reqheaders: { authorization: 'Bearer TRANSPORT_PRIVATE_SENTINEL' },
    })
      .put(uploadPath, 'image bytes')
      .reply(201);
    const post = nock('https://api.linkedin.com').post('/v2/ugcPosts').reply(201, { id: '123' });
    await publish();
    expect(registration.isDone()).toBe(true);
    expect(upload.isDone()).toBe(true);
    expect(post.isDone()).toBe(true);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it.each([301, 302, 307, 308])(
    'does not follow an upload %i redirect or publish afterward',
    async (status) => {
      const registration = registerUpload();
      const upload = nock('https://www.linkedin.com')
        .put(uploadPath)
        .reply(status, 'TRANSPORT_PRIVATE_SENTINEL', {
          Location: 'https://attacker.example/steal',
        });
      const redirected = nock('https://attacker.example').put('/steal').reply(200);
      const post = nock('https://api.linkedin.com').post('/v2/ugcPosts').reply(201);
      await publish();
      expect(registration.isDone()).toBe(true);
      expect(upload.isDone()).toBe(true);
      expect(redirected.isDone()).toBe(false);
      expect(post.isDone()).toBe(false);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(JSON.stringify([res.json.mock.calls, errors.mock.calls])).not.toContain(
        'TRANSPORT_PRIVATE_SENTINEL',
      );
    },
  );
});
