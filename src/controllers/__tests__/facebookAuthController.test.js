jest.useFakeTimers();

const originalFacebookAppId = process.env.FACEBOOK_APP_ID;
const originalFacebookAppSecret = process.env.FACEBOOK_APP_SECRET;
process.env.FACEBOOK_APP_ID = 'test-facebook-app-id';
process.env.FACEBOOK_APP_SECRET = 'test-facebook-app-secret';

jest.mock('axios', () => ({
  get: jest.fn(),
}));

jest.mock('../../models/facebookConnections', () => {
  const MockFacebookConnection = jest.fn();
  MockFacebookConnection.collection = {
    dropIndex: jest.fn().mockResolvedValue(undefined),
  };
  MockFacebookConnection.getActiveConnection = jest.fn();
  MockFacebookConnection.deactivateAll = jest.fn();
  MockFacebookConnection.deleteMany = jest.fn();
  MockFacebookConnection.updateMany = jest.fn();
  return MockFacebookConnection;
});

jest.mock('../../utilities/permissions', () => ({
  hasPermission: jest.fn(),
}));

const axios = require('axios');
const FacebookConnection = require('../../models/facebookConnections');
const { hasPermission } = require('../../utilities/permissions');
const {
  connectPage,
  disconnectPage,
  getConnectionStatus,
  handleAuthCallback,
  verifyConnection,
} = require('../facebookAuthController');

const OWNER = { requestorId: 'owner-id', role: 'Owner' };
const ADMINISTRATOR = { requestorId: 'administrator-id', role: 'Administrator' };
const VOLUNTEER = { requestorId: 'volunteer-id', role: 'Volunteer' };
const EMAIL_SENDER = {
  requestorId: 'email-sender-id',
  role: 'Volunteer',
  permissions: ['sendEmails'],
};
const FORBIDDEN_RESPONSE = { error: 'You are not authorized to manage Facebook.' };
const PAGE_TOKEN = 'auth-page-token-secret';
const USER_TOKEN = 'auth-user-token-secret';

const makeResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

const expectNoTokenExposure = (value) => {
  const serialized = JSON.stringify(value);
  expect(serialized).not.toContain('pageAccessToken');
  expect(serialized).not.toContain('userAccessToken');
  expect(serialized).not.toContain(PAGE_TOKEN);
  expect(serialized).not.toContain(USER_TOKEN);
};

describe('facebookAuthController connection-management authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    hasPermission.mockResolvedValue(false);
  });

  afterAll(() => {
    if (originalFacebookAppId === undefined) delete process.env.FACEBOOK_APP_ID;
    else process.env.FACEBOOK_APP_ID = originalFacebookAppId;
    if (originalFacebookAppSecret === undefined) delete process.env.FACEBOOK_APP_SECRET;
    else process.env.FACEBOOK_APP_SECRET = originalFacebookAppSecret;
  });

  describe('getConnectionStatus', () => {
    it('allows an Owner to receive connection metadata', async () => {
      const connection = {
        pageId: '12345',
        pageName: 'One Community',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        connectedBy: { name: 'Owner User' },
        lastVerifiedAt: new Date('2026-01-02T00:00:00.000Z'),
        lastError: null,
        pageAccessToken: PAGE_TOKEN,
        userAccessToken: USER_TOKEN,
      };
      FacebookConnection.getActiveConnection.mockResolvedValue(connection);
      const res = makeResponse();

      await getConnectionStatus({ user: OWNER }, res);

      expect(hasPermission).toHaveBeenCalledWith(OWNER, 'postFacebookContent');
      expect(FacebookConnection.getActiveConnection).toHaveBeenCalledTimes(1);
      expect(FacebookConnection.getActiveConnection).toHaveBeenCalledWith();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        connected: true,
        pageId: '12345',
        pageName: 'One Community',
        connectedAt: connection.createdAt,
        connectedBy: 'Owner User',
        tokenStatus: 'valid',
        lastVerifiedAt: connection.lastVerifiedAt,
        lastError: null,
      });
      expectNoTokenExposure(res.json.mock.calls);
    });

    it('allows a user granted the canonical Facebook posting permission', async () => {
      hasPermission.mockResolvedValue(true);
      FacebookConnection.getActiveConnection.mockResolvedValue(null);
      const res = makeResponse();

      await getConnectionStatus({ user: VOLUNTEER }, res);

      expect(hasPermission).toHaveBeenCalledWith(VOLUNTEER, 'postFacebookContent');
      expect(FacebookConnection.getActiveConnection).toHaveBeenCalledTimes(1);
      expect(FacebookConnection.getActiveConnection).toHaveBeenCalledWith();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        connected: false,
        message: 'No Facebook Page connected',
      });
    });

    it('does not treat sendEmails as Facebook connection-management permission', async () => {
      const res = makeResponse();

      await getConnectionStatus({ user: EMAIL_SENDER }, res);

      expect(hasPermission).toHaveBeenCalledWith(EMAIL_SENDER, 'postFacebookContent');
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(FORBIDDEN_RESPONSE);
      expect(FacebookConnection.getActiveConnection).not.toHaveBeenCalled();
      const responseBody = res.json.mock.calls[0][0];
      expect(responseBody).not.toHaveProperty('connected');
      expect(responseBody).not.toHaveProperty('pageId');
      expect(responseBody).not.toHaveProperty('pageName');
      expect(responseBody).not.toHaveProperty('tokenStatus');
    });
  });

  describe('verifyConnection', () => {
    it('allows an Administrator to perform Facebook verification', async () => {
      const save = jest.fn().mockResolvedValue(undefined);
      const connection = {
        pageId: '12345',
        pageName: 'One Community',
        pageAccessToken: 'page-token',
        lastVerifiedAt: null,
        lastError: 'old error',
        save,
      };
      FacebookConnection.getActiveConnection.mockResolvedValue(connection);
      axios.get.mockResolvedValue({ data: { id: '12345', name: 'One Community' } });
      const res = makeResponse();

      await verifyConnection({ user: ADMINISTRATOR, body: {} }, res);

      expect(hasPermission).toHaveBeenCalledWith(ADMINISTRATOR, 'postFacebookContent');
      expect(FacebookConnection.getActiveConnection).toHaveBeenCalledTimes(1);
      expect(FacebookConnection.getActiveConnection).toHaveBeenCalledWith({
        includePageAccessToken: true,
      });
      expect(axios.get).toHaveBeenCalledWith('https://graph.facebook.com/v19.0/12345', {
        params: { access_token: 'page-token', fields: 'id,name' },
      });
      expect(connection.lastVerifiedAt).toBeInstanceOf(Date);
      expect(connection.lastError).toBeNull();
      expect(save).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        valid: true,
        pageId: '12345',
        pageName: 'One Community',
        lastVerifiedAt: connection.lastVerifiedAt,
      });
      expectNoTokenExposure(res.json.mock.calls);
    });

    it('rejects a forged privileged body when the authenticated user is unprivileged', async () => {
      const res = makeResponse();
      const req = {
        user: VOLUNTEER,
        body: {
          requestor: { requestorId: 'forged-owner-id', role: 'Owner' },
        },
      };

      await verifyConnection(req, res);

      expect(hasPermission).toHaveBeenCalledWith(VOLUNTEER, 'postFacebookContent');
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(FORBIDDEN_RESPONSE);
      expect(FacebookConnection.getActiveConnection).not.toHaveBeenCalled();
      expect(axios.get).not.toHaveBeenCalled();
    });

    it('uses a token-free requery when recording a verification failure', async () => {
      const tokenConnection = {
        pageId: '12345',
        pageAccessToken: PAGE_TOKEN,
      };
      const metadataConnection = {
        pageId: '12345',
        lastError: null,
        save: jest.fn().mockResolvedValue(undefined),
      };
      FacebookConnection.getActiveConnection
        .mockResolvedValueOnce(tokenConnection)
        .mockResolvedValueOnce(metadataConnection);
      axios.get.mockRejectedValue({
        response: { data: { error: { message: 'Facebook verification failed', code: 190 } } },
      });
      const res = makeResponse();

      await verifyConnection({ user: OWNER, body: {} }, res);

      expect(FacebookConnection.getActiveConnection).toHaveBeenNthCalledWith(1, {
        includePageAccessToken: true,
      });
      expect(FacebookConnection.getActiveConnection).toHaveBeenNthCalledWith(2);
      expect(metadataConnection.lastError).toBe('Facebook verification failed');
      expect(metadataConnection.save).toHaveBeenCalledTimes(1);
      expectNoTokenExposure(res.json.mock.calls);
    });
  });

  describe('existing protected connection operations', () => {
    it('exchanges and persists tokens without returning or logging either secret', async () => {
      const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      const save = jest.fn().mockResolvedValue(undefined);
      FacebookConnection.mockImplementationOnce((data) => ({
        ...data,
        createdAt: new Date('2026-01-04T00:00:00.000Z'),
        save,
      }));
      FacebookConnection.deleteMany.mockResolvedValue({ deletedCount: 0 });
      FacebookConnection.updateMany.mockResolvedValue({ modifiedCount: 0 });
      axios.get
        .mockResolvedValueOnce({ data: { access_token: USER_TOKEN, expires_in: 3600 } })
        .mockResolvedValueOnce({
          data: {
            data: [
              {
                id: '12345',
                name: 'One Community',
                category: 'Community',
                access_token: PAGE_TOKEN,
              },
            ],
          },
        })
        .mockResolvedValueOnce({ data: { id: '12345', name: 'One Community' } });
      const callbackRes = makeResponse();

      await handleAuthCallback(
        {
          user: OWNER,
          body: {
            accessToken: 'short-lived-token',
            userID: '98765',
            grantedScopes: 'pages_show_list',
          },
        },
        callbackRes,
      );

      const callbackPayload = callbackRes.json.mock.calls[0][0];
      expect(callbackRes.status).toHaveBeenCalledWith(200);
      expectNoTokenExposure(callbackPayload);

      const connectRes = makeResponse();
      await connectPage(
        {
          user: OWNER,
          body: { pageId: '12345', selectionNonce: callbackPayload.selectionNonce },
        },
        connectRes,
      );

      expect(FacebookConnection).toHaveBeenCalledWith(
        expect.objectContaining({
          pageAccessToken: PAGE_TOKEN,
          userAccessToken: USER_TOKEN,
        }),
      );
      expect(save).toHaveBeenCalledTimes(1);
      expect(connectRes.status).toHaveBeenCalledWith(200);
      expectNoTokenExposure(connectRes.json.mock.calls);
      expectNoTokenExposure(consoleLog.mock.calls);
      expectNoTokenExposure(consoleError.mock.calls);

      consoleLog.mockRestore();
      consoleError.mockRestore();
    });

    it('uses the authenticated user instead of forged callback and connect bodies', async () => {
      const callbackRes = makeResponse();
      const connectRes = makeResponse();
      const forgedBody = { requestor: OWNER };

      await handleAuthCallback({ user: VOLUNTEER, body: forgedBody }, callbackRes);
      await connectPage({ user: VOLUNTEER, body: forgedBody }, connectRes);

      expect(callbackRes.status).toHaveBeenCalledWith(403);
      expect(connectRes.status).toHaveBeenCalledWith(403);
      expect(hasPermission).toHaveBeenCalledWith(VOLUNTEER, 'postFacebookContent');
      expect(axios.get).not.toHaveBeenCalled();
    });

    it('keeps Owner access to callback and connect unchanged', async () => {
      const callbackRes = makeResponse();
      const connectRes = makeResponse();

      await handleAuthCallback({ user: OWNER, body: {} }, callbackRes);
      await connectPage({ user: OWNER, body: {} }, connectRes);

      expect(callbackRes.status).toHaveBeenCalledWith(400);
      expect(callbackRes.json).toHaveBeenCalledWith({
        error: 'accessToken and userID are required',
      });
      expect(connectRes.status).toHaveBeenCalledWith(400);
      expect(connectRes.json).toHaveBeenCalledWith({
        error: 'pageId and selectionNonce are required',
      });
    });

    it('keeps disconnect authorization and behavior unchanged', async () => {
      const forbiddenRes = makeResponse();

      await disconnectPage({ user: VOLUNTEER, body: { requestor: OWNER } }, forbiddenRes);

      expect(forbiddenRes.status).toHaveBeenCalledWith(403);
      expect(FacebookConnection.deactivateAll).not.toHaveBeenCalled();

      FacebookConnection.deactivateAll.mockResolvedValue({ modifiedCount: 0 });
      const ownerRes = makeResponse();

      await disconnectPage({ user: OWNER, body: { requestor: VOLUNTEER } }, ownerRes);

      expect(FacebookConnection.deactivateAll).toHaveBeenCalledWith({
        odUserId: 'owner-id',
        name: 'Unknown',
        role: 'Owner',
      });
      expect(ownerRes.status).toHaveBeenCalledWith(200);
    });
  });
});
