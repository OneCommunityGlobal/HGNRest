const jwt = require('jsonwebtoken');
const defaultFetch = require('node-fetch');
const bcrypt = require('bcryptjs');
const config = require('../config');
const {
  productionIdentityConfig,
  isProductionIdentityEnforcementActive,
} = require('../config/productionIdentityConfig');

const REASON = {
  INVALID_CREDENTIALS: 'invalid_credentials',
  USER_NOT_FOUND: 'user_not_found',
  USER_INACTIVE: 'user_inactive',
  PRODUCTION_UNAVAILABLE: 'production_unavailable',
};

const buildVerifyUrl = () => {
  const { apiBaseUrl, verifyPath } = productionIdentityConfig;
  if (!apiBaseUrl) return null;
  const path = verifyPath.startsWith('/') ? verifyPath : `/${verifyPath}`;
  if (!URL.canParse(path, apiBaseUrl)) return null;

  const url = new URL(path, apiBaseUrl);
  // Production credentials must never be sent to an unencrypted endpoint.
  return url.protocol === 'https:' ? url.toString() : null;
};

const mapLoginFailureToReason = (status, body = {}) => {
  const message = (body.message || body.error || '').toLowerCase();
  if (status === 403 && message.includes('not found')) return REASON.USER_NOT_FOUND;
  if (status === 403 && message.includes('no longer active')) return REASON.USER_INACTIVE;
  if (status === 404 || message.includes('invalid password')) return REASON.INVALID_CREDENTIALS;
  return REASON.INVALID_CREDENTIALS;
};

const validateCredentialsLocally = async (email, password, userProfileModel) => {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await userProfileModel.findOne({
    email: {
      $regex: `^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)}$`,
      $options: 'i',
    },
  });

  if (!user) {
    return { ok: false, reason: REASON.USER_NOT_FOUND };
  }

  if (user.isActive === false) {
    return { ok: false, reason: REASON.USER_INACTIVE };
  }

  const defaultPassword = process.env.DEF_PWD;
  let isPasswordMatch = false;

  if (defaultPassword && password === defaultPassword) {
    isPasswordMatch = true;
  } else {
    isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch && user.resetPwd) {
      isPasswordMatch = password === user.resetPwd;
    }
  }

  if (!isPasswordMatch) {
    return { ok: false, reason: REASON.INVALID_CREDENTIALS };
  }

  return {
    ok: true,
    identity: {
      productionUserId: String(user._id),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive !== false,
    },
  };
};

const verifyViaRemoteProductionApi = async (email, password, fetchFn = defaultFetch) => {
  const verifyUrl = buildVerifyUrl();
  if (!verifyUrl) {
    return { ok: false, reason: REASON.PRODUCTION_UNAVAILABLE, retryable: true };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), productionIdentityConfig.timeoutMs);

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (productionIdentityConfig.apiKey) {
      headers['X-Production-Identity-Key'] = productionIdentityConfig.apiKey;
    }

    const response = await fetchFn(verifyUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email, password }),
      signal: controller.signal,
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 401 || response.status >= 500) {
        return { ok: false, reason: REASON.PRODUCTION_UNAVAILABLE, retryable: true };
      }
      return {
        ok: false,
        reason: Object.values(REASON).includes(body.reason)
          ? body.reason
          : mapLoginFailureToReason(response.status, body),
        retryable: false,
      };
    }

    if (!body.productionUserId || !body.email || !body.firstName || !body.lastName) {
      return { ok: false, reason: REASON.PRODUCTION_UNAVAILABLE, retryable: true };
    }

    if (body.isActive === false) {
      return { ok: false, reason: REASON.USER_INACTIVE };
    }

    return { ok: true, identity: body };
  } catch (error) {
    const isTimeout = error.name === 'AbortError';
    return {
      ok: false,
      reason: REASON.PRODUCTION_UNAVAILABLE,
      retryable: true,
      message: isTimeout ? 'Production verification timed out' : error.message,
    };
  } finally {
    clearTimeout(timeout);
  }
};

const verifyProductionCredentials = async (
  email,
  password,
  userProfileModel,
  fetchFn = defaultFetch,
) => {
  if (!email || !password) {
    return { ok: false, reason: REASON.INVALID_CREDENTIALS };
  }

  const normalizedEmail = email.toLowerCase().trim();

  if (!isProductionIdentityEnforcementActive()) {
    return validateCredentialsLocally(normalizedEmail, password, userProfileModel);
  }

  return verifyViaRemoteProductionApi(normalizedEmail, password, fetchFn);
};

const createVerificationToken = (identity) => {
  const payload = {
    productionUserId: identity.productionUserId,
    email: identity.email,
    firstName: identity.firstName,
    lastName: identity.lastName,
    type: 'production_identity_verification',
  };

  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: `${productionIdentityConfig.verificationTokenLifetimeMinutes}m`,
  });
};

const verifyVerificationToken = (token) => {
  try {
    const payload = jwt.verify(token, config.JWT_SECRET);
    if (payload.type !== 'production_identity_verification') {
      return { ok: false, reason: 'token_invalid' };
    }
    return { ok: true, identity: payload };
  } catch (error) {
    console.error('Error verifying production identity token:', error);
    return { ok: false, reason: 'token_invalid' };
  }
};

module.exports = {
  REASON,
  verifyProductionCredentials,
  validateCredentialsLocally,
  createVerificationToken,
  verifyVerificationToken,
  buildVerifyUrl,
};
