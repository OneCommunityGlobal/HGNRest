process.env.JWT_SECRET = 'test-secret';
process.env.PRODUCTION_STATUS_WEBHOOK_SECRET = 'webhook-secret';
process.env.PRODUCTION_IDENTITY_API_KEY = 'test-api-key';

jest.mock('../../models/userProfile', () => ({
  findOne: jest.fn(),
}));

jest.mock('../../models/productionVerificationLog', () => ({
  create: jest.fn(),
}));

const userProfile = require('../../models/userProfile');
const ProductionVerificationLog = require('../../models/productionVerificationLog');
const productionIdentityController = require('../productionIdentityController');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('productionIdentityController', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      JWT_SECRET: 'test-secret',
      PRODUCTION_IDENTITY_VERIFICATION_ENABLED: 'false',
      dbName: 'hgnData_prod',
    };
    jest.resetModules();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('verifyProductionIdentity returns 400 when feature disabled', async () => {
    jest.resetModules();
    const controller = require('../productionIdentityController');
    const req = {
      body: { productionEmail: 'a@b.com', productionPassword: 'x' },
      ip: '127.0.0.1',
    };
    const res = mockRes();

    await controller.verifyProductionIdentity(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('not enabled') }),
    );
  });

  test('verifyProductionIdentityPublic rejects missing API key when configured', async () => {
    process.env.PRODUCTION_IDENTITY_API_KEY = 'test-api-key';
    jest.resetModules();
    const controller = require('../productionIdentityController');
    const req = {
      body: { email: 'user@example.com', password: 'pwd' },
      header: () => undefined,
    };
    const res = mockRes();

    await controller.verifyProductionIdentityPublic(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('verifyProductionIdentityPublic returns identity for valid local user', async () => {
    process.env.PRODUCTION_IDENTITY_API_KEY = 'test-api-key';
    process.env.PRODUCTION_IDENTITY_VERIFICATION_ENABLED = 'false';
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('CorrectPass1!', 10);

    jest.resetModules();
    const up = require('../../models/userProfile');
    const controller = require('../productionIdentityController');

    up.findOne.mockResolvedValue({
      _id: 'uid-1',
      email: 'user@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
      isActive: true,
      password: hash,
      resetPwd: '',
    });

    const req = {
      body: { email: 'user@example.com', password: 'CorrectPass1!' },
      header: (name) => (name === 'X-Production-Identity-Key' ? 'test-api-key' : undefined),
    };
    const res = mockRes();

    await controller.verifyProductionIdentityPublic(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        productionUserId: 'uid-1',
        email: 'user@example.com',
      }),
    );
  });

  test('verifyProductionIdentity logs failed attempt', async () => {
    process.env.PRODUCTION_IDENTITY_VERIFICATION_ENABLED = 'true';
    process.env.PRODUCTION_IDENTITY_DEV_DB_NAME = 'hgnData_dev';
    process.env.dbName = 'hgnData_dev';
    process.env.PRODUCTION_API_BASE_URL = '';

    jest.resetModules();
    const up = require('../../models/userProfile');
    const logModel = require('../../models/productionVerificationLog');
    const controller = require('../productionIdentityController');

    up.findOne.mockResolvedValue(null);

    const req = {
      body: {
        productionEmail: 'missing@example.com',
        productionPassword: 'pwd',
        requestor: { requestorId: 'admin-id' },
      },
      ip: '10.0.0.1',
    };
    const res = mockRes();

    await controller.verifyProductionIdentity(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(logModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'user_not_found',
        attemptedEmail: 'missing@example.com',
        ip: '10.0.0.1',
      }),
    );
  });
});
