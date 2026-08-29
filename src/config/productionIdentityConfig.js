require('dotenv').config();

const parseBoolean = (value, defaultValue = false) => {
  if (value === undefined || value === null || value === '') return defaultValue;
  return value === 'true' || value === '1';
};

const productionIdentityConfig = {
  verificationEnabled: parseBoolean(process.env.PRODUCTION_IDENTITY_VERIFICATION_ENABLED, false),
  devDbName: process.env.PRODUCTION_IDENTITY_DEV_DB_NAME || 'hgnData_dev',
  apiBaseUrl: (process.env.PRODUCTION_API_BASE_URL || '').replace(/\/$/, ''),
  verifyPath:
    process.env.PRODUCTION_IDENTITY_VERIFY_PATH || '/api/production-identity/public-verify',
  apiKey: process.env.PRODUCTION_IDENTITY_API_KEY || '',
  timeoutMs: Number(process.env.PRODUCTION_API_TIMEOUT_MS) || 3000,
  featureEnabledDate: process.env.PRODUCTION_IDENTITY_FEATURE_ENABLED_DATE || null,
  webhookSecret: process.env.PRODUCTION_STATUS_WEBHOOK_SECRET || '',
  webhookTargetUrl: (process.env.DEV_IDENTITY_WEBHOOK_URL || '').replace(/\/$/, ''),
  webhookEmitEnabled: parseBoolean(process.env.PRODUCTION_IDENTITY_WEBHOOK_EMIT_ENABLED, false),
  verificationTokenLifetimeMinutes:
    Number(process.env.PRODUCTION_IDENTITY_VERIFICATION_TOKEN_MINUTES) || 10,
};

const isDevDatabase = () => process.env.dbName === productionIdentityConfig.devDbName;

const isFeatureCutoffActive = () => {
  if (!productionIdentityConfig.featureEnabledDate) return true;
  const cutoff = new Date(productionIdentityConfig.featureEnabledDate);
  if (Number.isNaN(cutoff.getTime())) return true;
  return new Date() >= cutoff;
};

const isProductionIdentityEnforcementActive = () =>
  productionIdentityConfig.verificationEnabled && isDevDatabase() && isFeatureCutoffActive();

const shouldEmitProductionWebhooks = () =>
  productionIdentityConfig.webhookEmitEnabled &&
  !isDevDatabase() &&
  Boolean(productionIdentityConfig.webhookTargetUrl) &&
  Boolean(productionIdentityConfig.webhookSecret);

module.exports = {
  productionIdentityConfig,
  isDevDatabase,
  isFeatureCutoffActive,
  isProductionIdentityEnforcementActive,
  shouldEmitProductionWebhooks,
};
