process.env.PRODUCTION_STATUS_WEBHOOK_SECRET = 'webhook-secret';

jest.mock('../../models/userProfile', () => ({
  updateMany: jest.fn(),
}));

jest.mock('../../models/productionVerificationLog', () => ({
  create: jest.fn(),
}));

jest.mock('../../controllers/productionIdentityController', () => ({
  logVerificationAttempt: jest.fn(),
}));

const userProfile = require('../../models/userProfile');
const productionWebhookController = require('../productionWebhookController');
const { buildSignature } = require('../../services/productionWebhookEmitter');

describe('productionWebhookController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    userProfile.updateMany.mockResolvedValue({ matchedCount: 2, modifiedCount: 2 });
  });

  const buildReq = (body) => {
    const payload = JSON.stringify(body);
    return {
      body,
      ip: '127.0.0.1',
      header: (name) => (name === 'X-Webhook-Signature' ? buildSignature(payload) : undefined),
    };
  };

  test('rejects invalid webhook signature', async () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    await productionWebhookController.handleProductionUserStatus(
      {
        body: { email: 'user@example.com', status: 'inactive' },
        ip: '127.0.0.1',
        header: () => 'invalid',
      },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('deactivates linked dev accounts for inactive webhook', async () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    const body = {
      productionUserId: 'prod-1',
      email: 'user@example.com',
      status: 'inactive',
      timestamp: new Date().toISOString(),
    };

    await productionWebhookController.handleProductionUserStatus(buildReq(body), res);

    expect(userProfile.updateMany).toHaveBeenCalledWith(
      {
        $or: [{ productionUserId: 'prod-1' }, { linkedProdEmail: 'user@example.com' }],
        identityLocked: true,
      },
      {
        $set: {
          isActive: false,
          deactivatedByProductionSync: true,
          productionDeactivatedAt: expect.any(Date),
        },
      },
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('reactivates linked dev accounts for active webhook', async () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    const body = {
      productionUserId: 'prod-1',
      email: 'user@example.com',
      status: 'active',
      timestamp: new Date().toISOString(),
    };

    await productionWebhookController.handleProductionUserStatus(buildReq(body), res);

    expect(userProfile.updateMany).toHaveBeenCalledWith(expect.any(Object), {
      $set: {
        isActive: true,
        deactivatedByProductionSync: false,
        productionDeactivatedAt: null,
      },
    });
  });

  test('rejects webhook with invalid status value', async () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    const body = {
      productionUserId: 'prod-1',
      email: 'user@example.com',
      status: 'paused',
      timestamp: new Date().toISOString(),
    };

    await productionWebhookController.handleProductionUserStatus(buildReq(body), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(userProfile.updateMany).not.toHaveBeenCalled();
  });

  test('rejects webhook without email or productionUserId', async () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    const body = {
      status: 'inactive',
      timestamp: new Date().toISOString(),
    };

    await productionWebhookController.handleProductionUserStatus(buildReq(body), res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('syncLinkedDevAccounts returns zero when no identifiers provided', async () => {
    const result = await productionWebhookController.syncLinkedDevAccounts({
      productionUserId: null,
      email: null,
      isActive: false,
    });

    expect(result.matchedCount).toBe(0);
    expect(userProfile.updateMany).not.toHaveBeenCalled();
  });
});
