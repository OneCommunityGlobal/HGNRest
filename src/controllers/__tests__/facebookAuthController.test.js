jest.useFakeTimers();

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
const FORBIDDEN_RESPONSE = { error: 'You are not authorized to manage Facebook.' };

const makeResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

describe('facebookAuthController connection-management authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    hasPermission.mockResolvedValue(false);
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
      };
      FacebookConnection.getActiveConnection.mockResolvedValue(connection);
      const res = makeResponse();

      await getConnectionStatus({ user: OWNER }, res);

      expect(hasPermission).toHaveBeenCalledWith(OWNER, 'postFacebookContent');
      expect(FacebookConnection.getActiveConnection).toHaveBeenCalledTimes(1);
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
    });

    it('allows a user granted the canonical Facebook posting permission', async () => {
      hasPermission.mockResolvedValue(true);
      FacebookConnection.getActiveConnection.mockResolvedValue(null);
      const res = makeResponse();

      await getConnectionStatus({ user: VOLUNTEER }, res);

      expect(hasPermission).toHaveBeenCalledWith(VOLUNTEER, 'postFacebookContent');
      expect(FacebookConnection.getActiveConnection).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        connected: false,
        message: 'No Facebook Page connected',
      });
    });

    it('rejects an unprivileged user before reading connection metadata', async () => {
      const res = makeResponse();

      await getConnectionStatus({ user: VOLUNTEER }, res);

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
  });

  describe('existing protected connection operations', () => {
    it('keeps callback and connect blocked for an unprivileged user', async () => {
      const callbackRes = makeResponse();
      const connectRes = makeResponse();

      await handleAuthCallback({ body: { requestor: VOLUNTEER } }, callbackRes);
      await connectPage({ body: { requestor: VOLUNTEER } }, connectRes);

      expect(callbackRes.status).toHaveBeenCalledWith(403);
      expect(connectRes.status).toHaveBeenCalledWith(403);
      expect(axios.get).not.toHaveBeenCalled();
    });

    it('keeps Owner access to callback and connect unchanged', async () => {
      const callbackRes = makeResponse();
      const connectRes = makeResponse();

      await handleAuthCallback({ body: { requestor: OWNER } }, callbackRes);
      await connectPage({ body: { requestor: OWNER } }, connectRes);

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

      await disconnectPage({ body: { requestor: VOLUNTEER } }, forbiddenRes);

      expect(forbiddenRes.status).toHaveBeenCalledWith(403);
      expect(FacebookConnection.deactivateAll).not.toHaveBeenCalled();

      FacebookConnection.deactivateAll.mockResolvedValue({ modifiedCount: 0 });
      const ownerRes = makeResponse();

      await disconnectPage({ body: { requestor: OWNER } }, ownerRes);

      expect(FacebookConnection.deactivateAll).toHaveBeenCalledWith({
        odUserId: 'owner-id',
        name: 'Unknown',
        role: 'Owner',
      });
      expect(ownerRes.status).toHaveBeenCalledWith(200);
    });
  });
});
