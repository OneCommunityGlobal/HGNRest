const crypto = require('node:crypto');
const userProfile = require('../models/userProfile');
const ProductionVerificationLog = require('../models/productionVerificationLog');
const { productionIdentityConfig } = require('../config/productionIdentityConfig');
const { buildSignature } = require('../services/productionWebhookEmitter');
const { logVerificationAttempt } = require('./productionIdentityController');

const verifyWebhookSignature = (req) => {
  const signature = req.header('X-Webhook-Signature');
  if (!signature || !productionIdentityConfig.webhookSecret) return false;

  const payload = JSON.stringify(req.body);
  const expected = buildSignature(payload);

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch (error) {
    return false;
  }
};

const syncLinkedDevAccounts = async ({ productionUserId, email, isActive }) => {
  const query = {
    $or: [
      ...(productionUserId ? [{ productionUserId: String(productionUserId) }] : []),
      ...(email ? [{ linkedProdEmail: email.toLowerCase() }] : []),
    ],
  };

  if (!query.$or.length) {
    return { matchedCount: 0, modifiedCount: 0 };
  }

  const update = {
    isActive,
    deactivatedByProductionSync: !isActive,
    productionDeactivatedAt: isActive ? null : new Date(),
  };

  const result = await userProfile.updateMany({ ...query, identityLocked: true }, { $set: update });

  return {
    matchedCount: result.n || result.matchedCount || 0,
    modifiedCount: result.nModified || result.modifiedCount || 0,
  };
};

const handleProductionUserStatus = async (req, res) => {
  if (!verifyWebhookSignature(req)) {
    return res.status(401).send({ error: 'Invalid webhook signature' });
  }

  const { productionUserId, email, status } = req.body;

  if (!email && !productionUserId) {
    return res.status(400).send({ error: 'productionUserId or email is required' });
  }

  if (!['active', 'inactive'].includes(status)) {
    return res.status(400).send({ error: 'status must be active or inactive' });
  }

  const isActive = status === 'active';
  const syncResult = await syncLinkedDevAccounts({
    productionUserId,
    email,
    isActive,
  });

  await logVerificationAttempt({
    ip: req.ip,
    reason: isActive ? 'webhook_reactivation' : 'webhook_deactivation',
    attemptedEmail: email,
    action: 'webhook_sync',
    metadata: { productionUserId, syncResult },
  });

  return res.status(200).send({
    message: 'Linked Dev accounts updated',
    ...syncResult,
  });
};

module.exports = {
  handleProductionUserStatus,
  syncLinkedDevAccounts,
};
