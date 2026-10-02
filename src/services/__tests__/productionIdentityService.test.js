process.env.JWT_SECRET = 'test-secret';
process.env.PRODUCTION_IDENTITY_VERIFICATION_ENABLED = 'true';
process.env.dbName = 'hgnData_dev';
process.env.PRODUCTION_API_BASE_URL = 'https://production.example.com/api';
process.env.PRODUCTION_STATUS_WEBHOOK_SECRET = 'webhook-secret';

const productionIdentityService = require('../productionIdentityService');

describe('productionIdentityService', () => {
  const originalEnv = process.env;

  afterAll(() => {
    process.env = originalEnv;
  });

  test('verifyProductionCredentials returns inactive reason for inactive production user', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ message: 'Sorry, this account is no longer active.' }),
    });

    const result = await productionIdentityService.verifyProductionCredentials(
      'user@example.com',
      'Password1!',
      {},
      fetchMock,
    );

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('user_inactive');
    expect(fetchMock).toHaveBeenCalled();
  });

  test('verifyProductionCredentials returns identity on success', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        productionUserId: 'abc123',
        email: 'user@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
        isActive: true,
      }),
    });

    const result = await productionIdentityService.verifyProductionCredentials(
      'user@example.com',
      'Password1!',
      {},
      fetchMock,
    );

    expect(result.ok).toBe(true);
    expect(result.identity.email).toBe('user@example.com');
  });

  test('verifyProductionCredentials returns retryable production_unavailable on timeout', async () => {
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    const fetchMock = jest.fn().mockRejectedValue(abortError);

    const result = await productionIdentityService.verifyProductionCredentials(
      'user@example.com',
      'Password1!',
      {},
      fetchMock,
    );

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('production_unavailable');
    expect(result.retryable).toBe(true);
  });

  test('createVerificationToken and verifyVerificationToken round trip', () => {
    const identity = {
      productionUserId: 'abc123',
      email: 'user@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
    };

    const token = productionIdentityService.createVerificationToken(identity);
    const verified = productionIdentityService.verifyVerificationToken(token);

    expect(verified.ok).toBe(true);
    expect(verified.identity.productionUserId).toBe('abc123');
  });
});

describe('productionIdentityConfig', () => {
  test('isProductionIdentityEnforcementActive is true only on configured dev database', () => {
    jest.resetModules();
    process.env.PRODUCTION_IDENTITY_VERIFICATION_ENABLED = 'true';
    process.env.PRODUCTION_IDENTITY_DEV_DB_NAME = 'hgnData_dev';
    process.env.dbName = 'hgnData_dev';

    const config = require('../../config/productionIdentityConfig');
    expect(config.isProductionIdentityEnforcementActive()).toBe(true);

    process.env.dbName = 'hgnData_prod';
    jest.resetModules();
    const prodConfig = require('../../config/productionIdentityConfig');
    expect(prodConfig.isProductionIdentityEnforcementActive()).toBe(false);
  });
});

describe('productionWebhookEmitter', () => {
  test('buildSignature is deterministic', () => {
    process.env.PRODUCTION_STATUS_WEBHOOK_SECRET = 'secret';
    jest.resetModules();
    const emitter = require('../productionWebhookEmitter');
    const signature = emitter.buildSignature('{"status":"inactive"}');
    expect(signature).toHaveLength(64);
    expect(signature).toBe(emitter.buildSignature('{"status":"inactive"}'));
  });
});
