process.env.JWT_SECRET = 'test-secret';

describe('productionIdentityConfig', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    jest.resetModules();
  });

  test('is active for Dev even when an old feature date is in the future', () => {
    process.env.PRODUCTION_IDENTITY_DEV_DB_NAME = 'hgnData_dev';
    process.env.dbName = 'hgnData_dev';
    process.env.PRODUCTION_IDENTITY_FEATURE_ENABLED_DATE = '2099-01-01';

    jest.resetModules();
    const config = require('../productionIdentityConfig');
    expect(config.isProductionIdentityEnforcementActive()).toBe(true);
  });

  test('cannot be disabled for Dev by an old feature flag', () => {
    process.env.PRODUCTION_IDENTITY_VERIFICATION_ENABLED = 'false';
    process.env.dbName = 'hgnData_dev';

    jest.resetModules();
    const config = require('../productionIdentityConfig');
    expect(config.isProductionIdentityEnforcementActive()).toBe(true);
  });

  test('does not enforce Dev identity rules against Production', () => {
    process.env.dbName = 'hgnData_prod';

    jest.resetModules();
    const config = require('../productionIdentityConfig');
    expect(config.isProductionIdentityEnforcementActive()).toBe(false);
  });
});
