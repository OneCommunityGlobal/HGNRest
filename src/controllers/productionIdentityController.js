const userProfile = require('../models/userProfile');
const ProductionVerificationLog = require('../models/productionVerificationLog');
const {
  verifyProductionCredentials,
  createVerificationToken,
  REASON,
} = require('../services/productionIdentityService');
const { isProductionIdentityEnforcementActive } = require('../config/productionIdentityConfig');

const ERROR_MESSAGES = {
  [REASON.INVALID_CREDENTIALS]:
    'The Production email or password is incorrect. Please use your Production sign-in credentials.',
  [REASON.USER_NOT_FOUND]:
    'No Production account exists for that email. Only existing Production users can create Dev accounts.',
  [REASON.USER_INACTIVE]:
    'This Production account is inactive. Dev accounts cannot be created for inactive Production users.',
  [REASON.PRODUCTION_UNAVAILABLE]:
    'Production identity verification is temporarily unavailable. Please try again.',
};

const logVerificationAttempt = async ({
  ip,
  reason,
  attemptedEmail,
  requestorId,
  action = 'verify_identity',
  metadata,
}) => {
  try {
    await ProductionVerificationLog.create({
      ip,
      reason,
      attemptedEmail,
      requestorId,
      action,
      metadata,
    });
  } catch (error) {
    // Logging must not block the request path.
    console.error('Failed to write production verification log:', error.message);
  }
};

const verifyProductionIdentity = async (req, res) => {
  if (!isProductionIdentityEnforcementActive()) {
    return res.status(400).send({
      error: 'Production identity verification is not enabled for this environment.',
    });
  }

  const { productionEmail, productionPassword } = req.body;
  const result = await verifyProductionCredentials(
    productionEmail,
    productionPassword,
    userProfile,
  );

  if (!result.ok) {
    await logVerificationAttempt({
      ip: req.ip,
      reason: result.reason,
      attemptedEmail: productionEmail,
      requestorId: req.body.requestor?.requestorId,
      metadata: { retryable: result.retryable || false },
    });

    return res.status(result.retryable ? 503 : 400).send({
      error: ERROR_MESSAGES[result.reason] || ERROR_MESSAGES[REASON.INVALID_CREDENTIALS],
      reason: result.reason,
      retryable: Boolean(result.retryable),
      type: result.reason,
    });
  }

  const verificationToken = createVerificationToken(result.identity);

  return res.status(200).send({
    productionUserId: result.identity.productionUserId,
    email: result.identity.email,
    firstName: result.identity.firstName,
    lastName: result.identity.lastName,
    verificationToken,
  });
};

const verifyProductionIdentityPublic = async (req, res) => {
  const apiKey = req.header('X-Production-Identity-Key');
  const { productionIdentityConfig } = require('../config/productionIdentityConfig');

  if (productionIdentityConfig.apiKey && apiKey !== productionIdentityConfig.apiKey) {
    return res.status(401).send({ error: 'Unauthorized', reason: REASON.INVALID_CREDENTIALS });
  }

  const { email, password } = req.body;
  const result = await verifyProductionCredentials(email, password, userProfile);

  if (!result.ok) {
    return res.status(400).send({
      error: 'Verification failed',
      reason: result.reason,
    });
  }

  return res.status(200).send(result.identity);
};

module.exports = {
  verifyProductionIdentity,
  verifyProductionIdentityPublic,
  logVerificationAttempt,
  ERROR_MESSAGES,
};
