process.env.JWT_SECRET = 'test-secret';
process.env.PRODUCTION_STATUS_WEBHOOK_SECRET = 'webhook-secret';

const productionIdentityService = require('../productionIdentityService');

const { REASON } = productionIdentityService;

describe('productionIdentityService — credential scenarios', () => {
  test('returns invalid_credentials when email or password missing', async () => {
    const result = await productionIdentityService.verifyProductionCredentials(
      '',
      'pwd',
      {},
      jest.fn(),
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe(REASON.INVALID_CREDENTIALS);
  });

  test('returns user_not_found for unknown local user', async () => {
    const userProfileModel = {
      findOne: jest.fn().mockResolvedValue(null),
    };

    const result = await productionIdentityService.verifyProductionCredentials(
      'missing@example.com',
      'Password1!',
      userProfileModel,
    );

    expect(result.ok).toBe(false);
    expect(result.reason).toBe(REASON.USER_NOT_FOUND);
  });

  test('returns user_inactive for inactive local user', async () => {
    const userProfileModel = {
      findOne: jest.fn().mockResolvedValue({
        _id: 'id1',
        email: 'inactive@example.com',
        firstName: 'In',
        lastName: 'Active',
        isActive: false,
        password: 'hash',
      }),
    };

    const result = await productionIdentityService.verifyProductionCredentials(
      'inactive@example.com',
      'Password1!',
      userProfileModel,
    );

    expect(result.ok).toBe(false);
    expect(result.reason).toBe(REASON.USER_INACTIVE);
  });

  test('returns invalid_credentials for wrong local password', async () => {
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('CorrectPass1!', 10);
    const userProfileModel = {
      findOne: jest.fn().mockResolvedValue({
        _id: 'id1',
        email: 'user@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
        isActive: true,
        password: hash,
        resetPwd: '',
      }),
    };

    const result = await productionIdentityService.verifyProductionCredentials(
      'user@example.com',
      'WrongPass1!',
      userProfileModel,
    );

    expect(result.ok).toBe(false);
    expect(result.reason).toBe(REASON.INVALID_CREDENTIALS);
  });

  test('returns identity for valid local credentials', async () => {
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('CorrectPass1!', 10);
    const userProfileModel = {
      findOne: jest.fn().mockResolvedValue({
        _id: 'id1',
        email: 'user@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
        isActive: true,
        password: hash,
        resetPwd: '',
      }),
    };

    const result = await productionIdentityService.verifyProductionCredentials(
      'user@example.com',
      'CorrectPass1!',
      userProfileModel,
    );

    expect(result.ok).toBe(true);
    expect(result.identity.productionUserId).toBe('id1');
    expect(result.identity.email).toBe('user@example.com');
  });

  test('returns invalid_credentials for remote 404 response', async () => {
    process.env.PRODUCTION_IDENTITY_VERIFICATION_ENABLED = 'true';
    process.env.dbName = 'hgnData_dev';
    process.env.PRODUCTION_API_BASE_URL = 'https://production.example.com/api';
    jest.resetModules();
    const service = require('../productionIdentityService');

    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ message: 'Invalid password.' }),
    });

    const result = await service.verifyProductionCredentials(
      'user@example.com',
      'bad',
      {},
      fetchMock,
    );

    expect(result.reason).toBe(REASON.INVALID_CREDENTIALS);
  });

  test('returns user_not_found for remote 403 username not found', async () => {
    process.env.PRODUCTION_IDENTITY_VERIFICATION_ENABLED = 'true';
    process.env.dbName = 'hgnData_dev';
    process.env.PRODUCTION_API_BASE_URL = 'https://production.example.com/api';
    jest.resetModules();
    const service = require('../productionIdentityService');

    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ message: 'Username not found.' }),
    });

    const result = await service.verifyProductionCredentials(
      'ghost@example.com',
      'bad',
      {},
      fetchMock,
    );

    expect(result.reason).toBe(REASON.USER_NOT_FOUND);
  });

  test('returns production_unavailable when remote body is incomplete', async () => {
    process.env.PRODUCTION_IDENTITY_VERIFICATION_ENABLED = 'true';
    process.env.dbName = 'hgnData_dev';
    process.env.PRODUCTION_API_BASE_URL = 'https://production.example.com/api';
    jest.resetModules();
    const service = require('../productionIdentityService');

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ email: 'only-email@example.com' }),
    });

    const result = await service.verifyProductionCredentials(
      'only-email@example.com',
      'pwd',
      {},
      fetchMock,
    );

    expect(result.ok).toBe(false);
    expect(result.reason).toBe(REASON.PRODUCTION_UNAVAILABLE);
    expect(result.retryable).toBe(true);
  });

  test('returns retryable production_unavailable on HTTP 500', async () => {
    process.env.PRODUCTION_IDENTITY_VERIFICATION_ENABLED = 'true';
    process.env.dbName = 'hgnData_dev';
    process.env.PRODUCTION_API_BASE_URL = 'https://production.example.com/api';
    jest.resetModules();
    const service = require('../productionIdentityService');

    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'server error' }),
    });

    const result = await service.verifyProductionCredentials(
      'user@example.com',
      'pwd',
      {},
      fetchMock,
    );

    expect(result.retryable).toBe(true);
  });
});

describe('productionIdentityService — verification token scenarios', () => {
  test('rejects expired verification token', () => {
    const jwt = require('jsonwebtoken');
    const expiredToken = jwt.sign(
      {
        productionUserId: 'abc',
        email: 'user@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
        type: 'production_identity_verification',
      },
      'test-secret',
      { expiresIn: -1 },
    );

    const verified = productionIdentityService.verifyVerificationToken(expiredToken);
    expect(verified.ok).toBe(false);
    expect(verified.reason).toBe('token_invalid');
  });

  test('rejects token with wrong type claim', () => {
    const jwt = require('jsonwebtoken');
    const badToken = jwt.sign({ email: 'user@example.com', type: 'other_type' }, 'test-secret', {
      expiresIn: '10m',
    });

    const verified = productionIdentityService.verifyVerificationToken(badToken);
    expect(verified.ok).toBe(false);
  });

  test('rejects tampered token', () => {
    const token = productionIdentityService.createVerificationToken({
      productionUserId: 'abc',
      email: 'user@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
    });

    const verified = productionIdentityService.verifyVerificationToken(`${token}tampered`);
    expect(verified.ok).toBe(false);
  });
});
