const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TURNSTILE_TIMEOUT_MS = 5000;

const isTurnstileEnabled = () => Boolean(process.env.TURNSTILE_SECRET_KEY);

/**
 * Verify a Cloudflare Turnstile token. Only active when TURNSTILE_SECRET_KEY is set.
 *
 * Fails open: if Cloudflare is unreachable, times out, or answers with a non-2xx status or an
 * unreadable body, we log and report `unavailable` so the caller lets the application through
 * (a lost applicant costs more than one spam message; the other bot layers still apply).
 *
 * @param {string} token value of the `cf-turnstile-response` field
 * @param {string} [remoteIp] client IP, forwarded to Cloudflare as an extra signal
 * @returns {Promise<{ status: 'skipped' | 'passed' | 'failed' | 'unavailable' }>}
 */
async function verifyTurnstileToken(token, remoteIp) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { status: 'skipped' };
  if (typeof token !== 'string' || !token.trim()) return { status: 'failed' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TURNSTILE_TIMEOUT_MS);
  try {
    const params = new URLSearchParams({ secret, response: token });
    if (remoteIp) params.set('remoteip', remoteIp);
    const res = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      body: params,
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error(`Turnstile verification unavailable (HTTP ${res.status}), letting through`);
      return { status: 'unavailable' };
    }
    const data = await res.json();
    return { status: data && data.success === true ? 'passed' : 'failed' };
  } catch (err) {
    console.error('Turnstile verification unavailable, letting through:', err.message);
    return { status: 'unavailable' };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  verifyTurnstileToken,
  isTurnstileEnabled,
  SITEVERIFY_URL,
  TURNSTILE_TIMEOUT_MS,
};
