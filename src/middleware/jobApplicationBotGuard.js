const { verifyTurnstileToken } = require('../utilities/turnstile');

// Field names the frontend must send. The honeypot is a visually hidden text input that real
// people never fill; `fillMs` is how long the form was open; the Turnstile widget posts its token
// as `cf-turnstile-response`.
const HONEYPOT_FIELD = 'website_url';
const FILL_MS_FIELD = 'fillMs';
const TURNSTILE_FIELD = 'cf-turnstile-response';
const MIN_FILL_MS = 3000;

const hasValue = (value) => value != null && String(value).trim() !== '';

const maskEmail = (email) => {
  const value = String(email || '');
  const at = value.indexOf('@');
  if (at === -1) return `${value.charAt(0)}***`;
  return `${value.charAt(0)}***${value.slice(at)}`;
};

function applicantEmailForLog(req) {
  try {
    // eslint-disable-next-line global-require
    const { resolveApplicationInput } = require('../controllers/collaborationController');
    const resolved = resolveApplicationInput(req.body || {});
    return maskEmail(resolved && resolved.email);
  } catch {
    return maskEmail('');
  }
}

/**
 * Runs after the multipart body is parsed. A filled honeypot or a too-fast fill is a bot: answer
 * with a normal-looking 201 and save nothing, so the bot does not learn which rule it tripped.
 * A missing or non-numeric `fillMs` is allowed (old cached frontends). When TURNSTILE_SECRET_KEY
 * is set, a missing or invalid token is a 400; Cloudflare being unreachable lets the request pass.
 */
async function jobApplicationBotGuard(req, res, next) {
  const body = req.body || {};

  const honeypotFilled = hasValue(body[HONEYPOT_FIELD]);
  const fillMs = hasValue(body[FILL_MS_FIELD]) ? Number(body[FILL_MS_FIELD]) : Number.NaN;
  const tooFast = Number.isFinite(fillMs) && fillMs < MIN_FILL_MS;

  if (honeypotFilled || tooFast) {
    console.warn(
      `Job application dropped as bot (${honeypotFilled ? 'honeypot' : 'fast fill'}) ` +
        `from ${req.ip} for ${applicantEmailForLog(req)}`,
    );
    res.status(201).json({ message: 'Application submitted successfully.' });
    return;
  }

  const result = await verifyTurnstileToken(body[TURNSTILE_FIELD], req.ip);
  if (result.status === 'failed') {
    res.status(400).json({ error: 'Verification failed. Please try again.' });
    return;
  }
  next();
}

module.exports = {
  jobApplicationBotGuard,
  HONEYPOT_FIELD,
  FILL_MS_FIELD,
  TURNSTILE_FIELD,
  MIN_FILL_MS,
};
