const Response = require('../models/jobApplicationsModel');

// Caps on application confirmation emails, over a rolling 24 h window.
// Without them, one public caller can make us email a victim once per open form,
// or burn the shared Gmail quota that password resets also depend on.
const MAX_CONFIRMATIONS_PER_ADDRESS = 3;
const MAX_CONFIRMATIONS_PER_DAY = 300;
const WINDOW_MS = 24 * 60 * 60 * 1000;

const maskEmail = (email) => {
  const value = String(email || '');
  const at = value.indexOf('@');
  if (at === -1) return `${value.charAt(0)}***`;
  return `${value.charAt(0)}***${value.slice(at)}`;
};

/**
 * Decide whether to send a confirmation email for an application that was just saved.
 *
 * Off-by-one: this runs after the application is saved, so the counts already include it.
 * We skip only when a count is strictly greater than its cap: the 3rd application from one
 * address in 24 h (count 3) still gets an email, the 4th (count 4) does not; globally the
 * 300th still gets one, the 301st does not.
 *
 * Fails open: if counting throws, we log and send, so a DB hiccup never blocks a
 * legitimate confirmation.
 *
 * @param {string} email applicant email (normalized here to trimmed lower case)
 * @param {Date} [now] current time, injectable for tests
 * @returns {Promise<boolean>} true to send, false when a cap fired
 */
async function shouldSendConfirmation(email, now = new Date()) {
  const normalizedEmail = String(email || '')
    .trim()
    .toLowerCase();
  const since = new Date(now.getTime() - WINDOW_MS);

  let addressCount;
  let globalCount;
  try {
    [addressCount, globalCount] = await Promise.all([
      Response.countDocuments({ email: normalizedEmail, createdAt: { $gte: since } }),
      Response.countDocuments({ createdAt: { $gte: since } }),
    ]);
  } catch (err) {
    console.error('Confirmation email cap check failed, sending anyway:', err.message);
    return true;
  }

  let capFired = null;
  if (addressCount > MAX_CONFIRMATIONS_PER_ADDRESS) capFired = 'per-address';
  else if (globalCount > MAX_CONFIRMATIONS_PER_DAY) capFired = 'global';

  if (capFired) {
    console.warn(
      `Confirmation email skipped (${capFired} cap) for ${maskEmail(normalizedEmail)}: ` +
        `${addressCount} from this address, ${globalCount} total in the last 24h`,
    );
    return false;
  }
  return true;
}

module.exports = {
  shouldSendConfirmation,
  maskEmail,
  MAX_CONFIRMATIONS_PER_ADDRESS,
  MAX_CONFIRMATIONS_PER_DAY,
  WINDOW_MS,
};
