process.env.JWT_SECRET = 'test-secret';

const { isProductionIdentityEnforcementActive } = require('../productionIdentityConfig');

describe('productionIdentityConfig', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    jest.resetModules();
  });

  test('is inactive before feature enabled date', () => {
    process.env.PRODUCTION_IDENTITY_VERIFICATION_ENABLED = 'true';
    process.env.PRODUCTION_IDENTITY_DEV_DB_NAME = 'hgnData_dev';
    process.env.dbName = 'hgnData_dev';
    process.env.PRODUCTION_IDENTITY_FEATURE_ENABLED_DATE = '2099-01-01';

    jest.resetModules();
    const config = require('../productionIdentityConfig');
    expect(config.isProductionIdentityEnforcementActive()).toBe(false);
  });

  test('is inactive when verification flag is false', () => {
    process.env.PRODUCTION_IDENTITY_VERIFICATION_ENABLED = 'false';
    process.env.dbName = 'hgnData_dev';

    jest.resetModules();
    const config = require('../productionIdentityConfig');
    expect(config.isProductionIdentityEnforcementActive()).toBe(false);
  });
});
