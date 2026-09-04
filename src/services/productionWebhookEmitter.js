const crypto = require('node:crypto');
const fetch = require('node-fetch');
const {
  productionIdentityConfig,
  shouldEmitProductionWebhooks,
} = require('../config/productionIdentityConfig');

const buildSignature = (payload) =>
  crypto.createHmac('sha256', productionIdentityConfig.webhookSecret).update(payload).digest('hex');

const emitProductionUserStatusChange = async ({ productionUserId, email, status }) => {
  if (!shouldEmitProductionWebhooks()) return { emitted: false };

  const body = {
    productionUserId,
    email,
    status,
    timestamp: new Date().toISOString(),
  };

  const payload = JSON.stringify(body);
  const signature = buildSignature(payload);

  try {
    const response = await fetch(productionIdentityConfig.webhookTargetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
      },
      body: payload,
    });

    return { emitted: true, ok: response.ok, status: response.status };
  } catch (error) {
    return { emitted: true, ok: false, error: error.message };
  }
};

module.exports = {
  emitProductionUserStatusChange,
  buildSignature,
};
