// Small in-memory fixed-window rate limiter for the public job application submit route.
// Counters live in this process only: they reset on restart and are per server instance, so with
// several instances behind a load balancer the effective limit is a small multiple of the setting.
// A shared store (Redis) is the real fix for that and is out of scope here.

const IP_WINDOW_MS = 15 * 60 * 1000;
const IP_MAX_PER_WINDOW = 10;
const EMAIL_WINDOW_MS = 60 * 60 * 1000;
const EMAIL_MAX_PER_WINDOW = 5;
const MAX_TRACKED_KEYS = 10000;

const IP_LIMIT_MESSAGE = 'Too many applications from this connection. Please try again later.';
const EMAIL_LIMIT_MESSAGE = 'Too many applications for this email address. Please try again later.';

/**
 * Build a fixed-window limiter middleware.
 *
 * @param {object} options
 * @param {number} options.windowMs window length
 * @param {number} options.max requests allowed per key per window
 * @param {(req: object) => string | undefined} options.keyFn returns the key; a falsy key skips
 * @param {string} options.message error text for the 429 body
 * @param {() => number} [options.now] clock, injectable for tests
 * @param {number} [options.maxKeys] bound on tracked keys; oldest entries are evicted past it
 */
function createRateLimiter({
  windowMs,
  max,
  keyFn,
  message,
  now = Date.now,
  maxKeys = MAX_TRACKED_KEYS,
}) {
  const hits = new Map(); // key -> { count, resetAt }, in order of window start
  let lastSweep = now();

  const sweep = (current) => {
    lastSweep = current;
    hits.forEach((entry, key) => {
      if (entry.resetAt <= current) hits.delete(key);
    });
  };

  return function rateLimit(req, res, next) {
    let retryAfterSeconds = 0;
    try {
      const key = keyFn(req);
      if (key) {
        const current = now();
        if (current - lastSweep >= windowMs || hits.size >= maxKeys) sweep(current);

        let entry = hits.get(key);
        if (!entry) {
          if (hits.size >= maxKeys) {
            // Still full of live entries: evict the oldest so memory stays bounded.
            hits.delete(hits.keys().next().value);
          }
          entry = { count: 0, resetAt: current + windowMs };
          hits.set(key, entry);
        } else if (entry.resetAt <= current) {
          hits.delete(key); // re-insert so insertion order tracks window start
          entry = { count: 0, resetAt: current + windowMs };
          hits.set(key, entry);
        }
        entry.count += 1;
        if (entry.count > max) {
          retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - current) / 1000));
        }
      }
    } catch (err) {
      // Never block a real applicant because the limiter itself broke.
      console.error('Job application rate limiter error, letting request through:', err.message);
      retryAfterSeconds = 0;
    }

    if (retryAfterSeconds) {
      res.set('Retry-After', String(retryAfterSeconds));
      res.status(429).json({ error: message });
      return;
    }
    next();
  };
}

/**
 * Read the applicant email the same way the controller does (payload.applicantEmail, else
 * body.email), normalized to trimmed lower case. Returns '' when there is none or the body
 * cannot be read; the controller answers those requests with its own 400.
 */
function getApplicantEmailKey(req) {
  // Lazy require: avoids loading models and storage clients until a request arrives.
  // eslint-disable-next-line global-require
  const { resolveApplicationInput } = require('../controllers/collaborationController');
  const resolved = resolveApplicationInput((req && req.body) || {});
  if (!resolved || resolved.error || !resolved.email) return '';
  return String(resolved.email).trim().toLowerCase();
}

const createJobApplicationIpLimiter = (options = {}) =>
  createRateLimiter({
    windowMs: IP_WINDOW_MS,
    max: IP_MAX_PER_WINDOW,
    keyFn: (req) => req.ip,
    message: IP_LIMIT_MESSAGE,
    ...options,
  });

const createJobApplicationEmailLimiter = (options = {}) =>
  createRateLimiter({
    windowMs: EMAIL_WINDOW_MS,
    max: EMAIL_MAX_PER_WINDOW,
    keyFn: getApplicantEmailKey,
    message: EMAIL_LIMIT_MESSAGE,
    ...options,
  });

module.exports = {
  createRateLimiter,
  createJobApplicationIpLimiter,
  createJobApplicationEmailLimiter,
  jobApplicationIpLimiter: createJobApplicationIpLimiter(),
  jobApplicationEmailLimiter: createJobApplicationEmailLimiter(),
  IP_WINDOW_MS,
  IP_MAX_PER_WINDOW,
  EMAIL_WINDOW_MS,
  EMAIL_MAX_PER_WINDOW,
  IP_LIMIT_MESSAGE,
  EMAIL_LIMIT_MESSAGE,
};
