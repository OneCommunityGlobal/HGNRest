const {
  getMastodonCredentials,
  getLinkedInCredentials,
  publishingErrorStatus,
  logPublishingError,
} = require('../socialMediaCredentials');

describe('server-only social publishing configuration', () => {
  const original = { ...process.env };
  beforeEach(() => {
    process.env.MASTODON_ACCESS_TOKEN = 'mastodon-sentinel';
    process.env.MASTODON_ENDPOINT = 'https://mastodon.example';
    process.env.LINKEDIN_ACCESS_TOKEN = 'linkedin-sentinel';
    process.env.ORGANIZATION_URN = 'urn:li:organization:123';
  });
  afterEach(() => {
    process.env = { ...original };
    jest.restoreAllMocks();
  });

  it('resolves only the configured server credentials and observes rotation', () => {
    expect(getMastodonCredentials()).toEqual({
      endpoint: 'https://mastodon.example',
      headers: { Authorization: 'Bearer mastodon-sentinel' },
    });
    expect(getLinkedInCredentials()).toEqual({
      organizationUrn: 'urn:li:organization:123',
      accessToken: 'linkedin-sentinel',
    });
    process.env.MASTODON_ACCESS_TOKEN = 'rotated-mastodon';
    process.env.LINKEDIN_ACCESS_TOKEN = 'rotated-linkedin';
    expect(getMastodonCredentials().headers.Authorization).toBe('Bearer rotated-mastodon');
    expect(getLinkedInCredentials().accessToken).toBe('rotated-linkedin');
  });

  it.each(['', ' ', 'bad\r\nAuthorization: injected'])(
    'rejects missing or malformed tokens (%j)',
    (token) => {
      process.env.MASTODON_ACCESS_TOKEN = token;
      process.env.LINKEDIN_ACCESS_TOKEN = token;
      expect(getMastodonCredentials).toThrow('Social-media publishing is not configured.');
      expect(getLinkedInCredentials).toThrow('Social-media publishing is not configured.');
    },
  );

  it.each([
    'http://mastodon.example',
    'https://user:password@mastodon.example',
    'https://mastodon.example/?token=secret',
    'https://mastodon.example/#token',
    'https://mastodon.example/redirect',
    'not-a-url',
  ])('rejects unsafe Mastodon configuration %s', (endpoint) => {
    process.env.MASTODON_ENDPOINT = endpoint;
    expect(getMastodonCredentials).toThrow('Social-media publishing is not configured.');
  });

  it('uses the default HTTPS Mastodon host', () => {
    delete process.env.MASTODON_ENDPOINT;
    expect(getMastodonCredentials().endpoint).toBe('https://mastodon.social');
  });

  it.each(['', 'urn:li:person:123', 'https://example.com', 'urn:li:organization:123\n'])(
    'rejects an invalid LinkedIn organization %j',
    (urn) => {
      process.env.ORGANIZATION_URN = urn;
      expect(getLinkedInCredentials).toThrow('Social-media publishing is not configured.');
    },
  );

  it.each([401, 403, 429, 500, 503])(
    'preserves safe provider HTTP status %i without logging its message',
    (status) => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const error = Object.assign(new Error('Bearer linkedin-sentinel'), {
        response: { status, data: { token: 'mastodon-sentinel' } },
        config: { headers: { Authorization: 'linkedin-sentinel' } },
      });
      expect(publishingErrorStatus(error)).toBe(status);
      logPublishingError('Publishing failed:', error);
      expect(spy).toHaveBeenCalledWith('Publishing failed:', { status });
      expect(JSON.stringify(spy.mock.calls)).not.toMatch(/sentinel|Bearer/);
    },
  );

  it.each([200, 302, 999, '401', undefined])(
    'does not accept an unsafe HTTP error status %j',
    (status) => {
      expect(publishingErrorStatus({ response: { status } })).toBe(500);
    },
  );
});
