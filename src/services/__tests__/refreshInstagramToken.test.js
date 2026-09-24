jest.mock('axios');
jest.mock('../../models/metaToken');

const axios = require('axios');
const MetaToken = require('../../models/metaToken');
const refreshInstagramToken = require('../refreshInstagramToken');

describe('refreshInstagramToken', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...OLD_ENV,
      META_APP_ID: 'app-id-123',
      META_APP_SECRET: 'app-secret-456',
    };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('throws when no Instagram token document exists, without calling the API', async () => {
    MetaToken.findOne.mockResolvedValue(null);

    await expect(refreshInstagramToken()).rejects.toThrow(
      'No Instagram token found — run bootstrap script first.',
    );

    expect(MetaToken.findOne).toHaveBeenCalledWith({ platform: 'instagram' });
    expect(axios.get).not.toHaveBeenCalled();
  });

  describe('when a token document exists', () => {
    const existingToken = {
      platform: 'instagram',
      accessToken: 'old-access-token',
      expiresAt: new Date('2026-01-01T00:00:00Z'),
      lastRefreshedAt: new Date('2025-12-01T00:00:00Z'),
      save: jest.fn(),
    };

    let tokenDoc;

    beforeEach(() => {
      tokenDoc = {
        ...existingToken,
        save: jest.fn().mockResolvedValue(undefined),
      };
      MetaToken.findOne.mockResolvedValue(tokenDoc);
    });

    it('requests a refreshed token from the Graph API with the correct params', async () => {
      axios.get.mockResolvedValue({
        data: { access_token: 'new-access-token', expires_in: 5184000 },
      });

      await refreshInstagramToken();

      expect(axios.get).toHaveBeenCalledTimes(1);
      expect(axios.get).toHaveBeenCalledWith(
        'https://graph.facebook.com/v19.0/oauth/access_token',
        {
          params: {
            grant_type: 'fb_exchange_token',
            client_id: 'app-id-123',
            client_secret: 'app-secret-456',
            fb_exchange_token: 'old-access-token',
          },
        },
      );
    });

    it('updates the token document with the new access token and saves it', async () => {
      axios.get.mockResolvedValue({
        data: { access_token: 'new-access-token', expires_in: 5184000 },
      });

      await refreshInstagramToken();

      expect(tokenDoc.accessToken).toBe('new-access-token');
      expect(tokenDoc.save).toHaveBeenCalledTimes(1);
    });

    it('computes expiresAt as now + expires_in seconds', async () => {
      const fixedNow = new Date('2026-06-01T12:00:00Z').getTime();
      jest.spyOn(Date, 'now').mockReturnValue(fixedNow);

      axios.get.mockResolvedValue({
        data: { access_token: 'new-access-token', expires_in: 3600 },
      });

      await refreshInstagramToken();

      expect(tokenDoc.expiresAt).toEqual(new Date(fixedNow + 3600 * 1000));

      Date.now.mockRestore();
    });

    it('sets lastRefreshedAt to the current time', async () => {
      const before = Date.now();
      axios.get.mockResolvedValue({
        data: { access_token: 'new-access-token', expires_in: 3600 },
      });

      await refreshInstagramToken();
      const after = Date.now();

      expect(tokenDoc.lastRefreshedAt).toBeInstanceOf(Date);
      expect(tokenDoc.lastRefreshedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(tokenDoc.lastRefreshedAt.getTime()).toBeLessThanOrEqual(after);
    });

    it('returns the updated token document', async () => {
      axios.get.mockResolvedValue({
        data: { access_token: 'new-access-token', expires_in: 3600 },
      });

      const result = await refreshInstagramToken();

      expect(result).toBe(tokenDoc);
    });

    it('propagates the error and does not save if the Graph API call fails', async () => {
      const apiError = new Error('Graph API unavailable');
      axios.get.mockRejectedValue(apiError);

      await expect(refreshInstagramToken()).rejects.toThrow('Graph API unavailable');

      expect(tokenDoc.save).not.toHaveBeenCalled();
    });

    it('propagates the error if saving the token document fails', async () => {
      axios.get.mockResolvedValue({
        data: { access_token: 'new-access-token', expires_in: 3600 },
      });
      const saveError = new Error('DB write failed');
      tokenDoc.save.mockRejectedValue(saveError);

      await expect(refreshInstagramToken()).rejects.toThrow('DB write failed');

      // The in-memory doc was still mutated before the failed save.
      expect(tokenDoc.accessToken).toBe('new-access-token');
    });

    it('overwrites a previously set accessToken, expiresAt, and lastRefreshedAt', async () => {
      axios.get.mockResolvedValue({
        data: { access_token: 'brand-new-token', expires_in: 7200 },
      });

      await refreshInstagramToken();

      expect(tokenDoc.accessToken).not.toBe(existingToken.accessToken);
      expect(tokenDoc.expiresAt.getTime()).not.toBe(existingToken.expiresAt.getTime());
      expect(tokenDoc.lastRefreshedAt.getTime()).not.toBe(existingToken.lastRefreshedAt.getTime());
    });
  });
});
