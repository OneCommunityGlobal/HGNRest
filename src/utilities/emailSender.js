// src/utilities/emailSender.js
const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const crypto = require('crypto');
const logger = require('../startup/logger');
const EmailHistory = require('../models/emailHistory');
const EmailThread = require('../models/emailThread');

const config = {
  email: process.env.REACT_APP_EMAIL,
  clientId: process.env.REACT_APP_EMAIL_CLIENT_ID,
  clientSecret: process.env.REACT_APP_EMAIL_CLIENT_SECRET,
  redirectUri: process.env.REACT_APP_EMAIL_CLIENT_REDIRECT_URI,
  refreshToken: process.env.REACT_APP_EMAIL_REFRESH_TOKEN,
  batchSize: 50,
  concurrency: 3,
  rateLimitDelay: 1000,
};

const OAuth2Client = new google.auth.OAuth2(
  config.clientId,
  config.clientSecret,
  config.redirectUri,
);
OAuth2Client.setCredentials({ refresh_token: config.refreshToken });

// Create the email envelope (transport)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    type: 'OAuth2',
    user: config.email,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
  },
});

const sendEmail = async (mailOptions) => {
  try {
    const accessTokenResp = await OAuth2Client.getAccessToken();
    const token = typeof accessTokenResp === 'object' ? accessTokenResp?.token : accessTokenResp;

    if (!token) {
      throw new Error('NO_OAUTH_ACCESS_TOKEN');
    }

    mailOptions.auth = {
      type: 'OAuth2', // include type
      user: config.email,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      refreshToken: config.refreshToken,
      accessToken: token,
    };
    // Ensure threading headers are included in the outgoing mail options
    // Nodemailer accepts messageId, inReplyTo, and references as top-level options
    // and will include any headers provided in mailOptions.headers.
    try {
      if (mailOptions.messageId) {
        // set Message-ID both as option and header (header key uses 'Message-ID')
        mailOptions.headers = { ...mailOptions.headers, 'Message-ID': mailOptions.messageId };
      }

      if (mailOptions.inReplyTo) {
        mailOptions.headers = { ...mailOptions.headers, 'In-Reply-To': mailOptions.inReplyTo };
      }

      if (mailOptions.references) {
        // normalize references to a space-separated string per RFC
        const refs = Array.isArray(mailOptions.references)
          ? mailOptions.references.join(' ')
          : String(mailOptions.references);
        mailOptions.references = refs;
        mailOptions.headers = { ...mailOptions.headers, References: refs };
      }
    } catch (hdrErr) {
      // header construction should never block sending; log and continue
      logger.logException(hdrErr, 'Failed to attach threading headers to mailOptions');
    }

    const result = await transporter.sendMail(mailOptions);
    if (process.env.NODE_ENV === 'local') {
      logger.logInfo(`Email sent: ${JSON.stringify(result)}`);
    }
    return result;
  } catch (error) {
    console.error('Error sending email:', error);
    logger.logException(error, `Error sending email: ${mailOptions.to}`);
    throw error;
  }
};

const queue = [];
let isProcessing = false;

const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const normalize = (field) => {
  if (!field) {
    return [];
  }
  if (Array.isArray(field)) {
    return field;
  }
  return String(field).split(',');
};

const normalizeReferences = (refs) => {
  if (!refs) return [];
  if (Array.isArray(refs)) return refs;
  return String(refs)
    .split(' ')
    .map((s) => s.trim())
    .filter(Boolean);
};

const sendWithRetry = async (batch, retries = 3, baseDelay = 1000) => {
  const isBsAssignment = batch.meta?.type === 'blue_square_assignment';
  console.log('isBsAssignment:', isBsAssignment);
  // Use messageId as the unique key to prevent overwrites of different emails with same subject
  const key = batch.messageId || `${batch.to}|${batch.subject}|${batch.meta?.type}|${Date.now()}`;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const moment = require('moment-timezone');
      // const localDate = moment().tz('America/Los_Angeles').toDate(); // returns JS Date in LA time
      await sendEmail(batch);

      if (isBsAssignment) {
        await EmailHistory.findOneAndUpdate(
          { uniqueKey: key },
          {
            $set: {
              to: normalize(batch.to),
              cc: normalize(batch.cc),
              bcc: normalize(batch.bcc),
              subject: batch.subject,
              message: batch.html,
              status: 'SENT',
              // Threading / RFC fields
              messageId: batch.messageId || null,
              threadRootMessageId: batch.meta?.threadRootMessageId || batch.inReplyTo || null,
              references: normalizeReferences(batch.references),
              recipientUserId: batch.meta?.recipientUserId || null,
              weekStart: batch.meta?.weekStart || null,
              emailType: batch.meta?.type || null,
              sentAt: moment().tz('America/Los_Angeles').toDate(),
              updatedAt: moment().tz('America/Los_Angeles').toDate(),
            },
            $inc: { attempts: 1 },
          },
          { upsert: true, new: true },
        );
        console.log('Blue Square assignment log created in EmailHistory');
      }
      return true;
    } catch (err) {
      logger.logException(err, `Batch to ${batch.to || '(empty)'} attempt ${attempt}`);
      const moment = require('moment-timezone');

      if (attempt === retries && isBsAssignment) {
        await EmailHistory.findOneAndUpdate(
          { uniqueKey: key },
          {
            $set: {
              to: normalize(batch.to),
              cc: normalize(batch.cc),
              bcc: normalize(batch.bcc),
              subject: batch.subject,
              message: batch.html,
              status: 'FAILED',
              // include message/thread info for debugging even on failure
              messageId: batch.messageId || null,
              threadRootMessageId: batch.meta?.threadRootMessageId || batch.inReplyTo || null,
              references: normalizeReferences(batch.references),
              recipientUserId: batch.meta?.recipientUserId || null,
              weekStart: batch.meta?.weekStart || null,
              emailType: batch.meta?.type || null,
              updatedAt: moment().tz('America/Los_Angeles').toDate(),
            },
            $inc: { attempts: 1 },
          },
          { upsert: true, new: true },
        );
        console.log('Failed Blue Square assignment log created in EmailHistory');
      }
    }

    if (attempt < retries) await sleep(baseDelay * attempt); // backoff
  }
  return false;
};

const worker = async () => {
  while (true) {
    // atomically pull next batch item: { batch, resolve, reject }
    const item = queue.shift();
    if (!item) break; // queue drained for this worker

    const { batch, resolve, reject } = item;
    try {
      const success = await sendWithRetry(batch);
      if (success) {
        resolve('Email processed successfully');
      } else {
        // If retries exhausted without success (sendWithRetry returns false), we still resolve but maybe with a warning?
        // Or we can reject. Given existing logic returns false on failure but doesn't throw,
        // we'll resolve with a failure message or reject depending on preference.
        // The original code didn't throw on queue failure, just logged.
        // We'll reject to let the caller know it failed.
        reject(new Error('Email failed to send after retries'));
      }
    } catch (err) {
      reject(err);
    }

    if (config.rateLimitDelay) await sleep(config.rateLimitDelay); // pacing
  }
};

const processQueue = async () => {
  if (isProcessing || queue.length === 0) return;

  isProcessing = true;

  try {
    const n = Math.max(1, Number(config.concurrency) || 1);
    const workers = Array.from({ length: n }, () => worker());
    await Promise.all(workers); // drain-until-empty with N workers
  } finally {
    isProcessing = false;
  }
};

/**
 * Sends an email to one or more recipients, optionally including CC, BCC, attachments, and a reply-to address.
 * Emails are processed in batches and pushed to a queue for asynchronous sending.
 *
 * @param {string|string[]} recipients - The primary recipient(s) of the email. Can be a single email string or an array of email addresses.
 * @param {string} subject - The subject line of the email.
 * @param {string} message - The HTML body content of the email.
 * @param {Object[]|null} [attachments=null] - Optional array of attachment objects as expected by the email service.
 * @param {string[]|null} [cc=null] - Optional array of CC (carbon copy) email addresses.
 * @param {string|null} [replyTo=null] - Optional reply-to email address.
 * @param {string[]|null} [emailBccs=null] - Optional array of BCC (blind carbon copy) email addresses.
 * @param {Object} [opts={}] - Optional settings object.
 *   @param {string} [opts.type='general'] - Email type/category (e.g., 'blue_square_assignment', 'password_reset', 'weekly_summary').
 *   @param {string} [opts.threadKey] - Unique thread identifier for email threading (e.g., 'blue_square:507f1f77bcf86cd799439011:2025-11-16').
 *                                      Computed from opts.recipientUserId + opts.weekStart if not provided.
 *   @param {string} [opts.recipientUserId] - User ID (MongoDB ObjectId string) of the primary recipient. Used for per-user thread scoping and EmailHistory logging.
 *   @param {string} [opts.weekStart] - ISO week start date (YYYY-MM-DD, e.g., '2025-11-16'). Used for thread scoping and EmailHistory logging.
 *
 * @returns {Promise<string>} A promise that resolves when the email queue has been processed successfully or rejects on error.
 *
 * @throws {Error} Will reject the promise if there is an error processing the email queue.
 *
 * @example
 * // Basic usage (non-threaded)
 * emailSender(
 *   ['user@example.com'],
 *   'Welcome!',
 *   '<p>Hello, welcome to our platform.</p>',
 *   null,
 *   ['cc@example.com'],
 *   'noreply@example.com',
 *   ['bcc@example.com']
 * )
 * .then(console.log)
 * .catch(console.error);
 *
 * @example
 * // With threading (blue-square notification)
 * emailSender(
 *   ['user@example.com'],
 *   'You have been assigned a Blue Square',
 *   '<p>You received a blue square...</p>',
 *   null,
 *   null,
 *   'noreply@example.com',
 *   null,
 *   {
 *     type: 'blue_square_assignment',
 *     recipientUserId: '507f1f77bcf86cd799439011',
 *     weekStart: '2025-11-16'
 *     // threadKey will be auto-computed as 'blue_square:507f1f77bcf86cd799439011:2025-11-16'
 *   }
 * )
 * .then(console.log)
 * .catch(console.error);
 */

const emailSender = (
  recipients,
  subject,
  message,
  attachments = null,
  cc = null,
  replyTo = null,
  emailBccs = null,
  opts = {},
) => {
  const type = opts.type || 'general';
  const isReset = type === 'password_reset';

  if (
    !process.env.sendEmail ||
    (String(process.env.sendEmail).toLowerCase() === 'false' && !isReset)
  ) {
    return Promise.resolve('EMAIL_SENDING_DISABLED');
  }

  return new Promise((resolve, reject) => {
    const recipientsArray = Array.isArray(recipients) ? recipients : [recipients];

    // Extract thread options: compute threadKey if not provided
    const threadKey =
      opts.threadKey ||
      (opts.recipientUserId && opts.weekStart
        ? `${type}:${opts.recipientUserId}:${opts.weekStart}`
        : null);

    // Helper to generate RFC-like Message-ID using timestamp + random bytes
    const domain =
      config.email && config.email.includes('@')
        ? config.email.split('@')[1]
        : 'onecommunityglobal.org';

    const generateMessageId = () => {
      // Prefer standard UUIDv4 when available
      if (typeof crypto.randomUUID === 'function') {
        return `<${crypto.randomUUID()}@${domain}>`;
      }

      // Fallback: timestamp + more entropy
      const rand = crypto.randomBytes(12).toString('hex');
      return `<msg-${Date.now()}-${rand}@${domain}>`;
    };

    // Prepare and push batches asynchronously so we can perform atomic thread upserts
    (async () => {
      const moment = require('moment-timezone');
      try {
        // We'll collect all batch promises to wait for them if needed,
        // but emailSender is designed to return a single Promise that resolves when ALL batches
        // for this call are processed.
        const batchPromises = [];

        for (let i = 0; i < recipientsArray.length; i += config.batchSize) {
          const batchRecipients = recipientsArray.slice(i, i + config.batchSize);

          // per-batch/message Message-ID with DB uniqueness check (up to 5 attempts)
          let messageId = null;
          const maxGenAttempts = 5;
          for (let genAttempt = 0; genAttempt < maxGenAttempts; genAttempt += 1) {
            messageId = generateMessageId();
            // quick DB check to avoid extremely unlikely collisions
            // if EmailHistory already contains this messageId, regenerate
            // (this is defensive; collisions with crypto.randomUUID() are effectively impossible)
            // eslint-disable-next-line no-await-in-loop
            const exists = await EmailHistory.findOne({ messageId }).select('_id').lean();
            if (!exists) break;
            messageId = null; // try again
          }

          // If we somehow still have a collision, append pid-based suffix as a final fallback
          if (!messageId) {
            const fallbackId =
              typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID()
                : `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
            messageId = `<${fallbackId}-${process.pid}@${domain}>`;
          }

          // defaults for thread-related headers
          let threadRootMessageId = null;
          let inReplyTo = null;
          let references = [];

          if (threadKey) {
            // Use the messageId as the candidate thread root when inserting a new thread.
            const candidateRoot = messageId;

            // Attempt atomic upsert. Use rawResult to detect whether an insert occurred.
            const setOnInsert = {
              threadRootMessageId: candidateRoot,
              weekStart: opts.weekStart || '',
              emailType: type,
              recipientUserId: opts.recipientUserId || null,
              createdAt: moment().tz('America/Los_Angeles').toDate(),
              createdBy: 'system',
            };

            try {
              const res = await EmailThread.findOneAndUpdate(
                { threadKey },
                { $setOnInsert: setOnInsert },
                { upsert: true, new: true, rawResult: true },
              );

              // res.value is the document; res.lastErrorObject indicates upsert
              const doc = res.value;
              const upserted =
                res.lastErrorObject &&
                (res.lastErrorObject.upserted || res.lastErrorObject.updatedExisting === false);

              threadRootMessageId = doc.threadRootMessageId;

              if (upserted) {
                // This send created the thread root. For root message, do not set In-Reply-To.
                inReplyTo = null;
                references = [];
              } else {
                // Thread existed already; reply to the thread root
                inReplyTo = threadRootMessageId;
                references = [threadRootMessageId];
              }
            } catch (err) {
              // If a duplicate-key or race occurs, fallback to reading the existing thread
              logger.logException(err, `EmailThread upsert failed for threadKey=${threadKey}`);
              const existing = await EmailThread.findOne({ threadKey }).lean();
              if (existing) {
                threadRootMessageId = existing.threadRootMessageId;
                inReplyTo = threadRootMessageId;
                references = [threadRootMessageId];
              } else {
                // As a last resort, treat this message as non-threaded
                threadRootMessageId = null;
                inReplyTo = null;
                references = [];
              }
            }
          }

          // Create a deferred promise for this batch
          const batchPromise = new Promise((batchResolve, batchReject) => {
            // push batch with threading metadata AND promise callbacks for downstream steps
            queue.push({
              batch: {
                from: config.email,
                to: batchRecipients.length ? batchRecipients.join(',') : '',
                bcc: emailBccs ? emailBccs.join(',') : '',
                subject,
                html: message,
                attachments,
                cc,
                replyTo,
                messageId,
                inReplyTo,
                references,
                meta: {
                  type,
                  threadKey,
                  recipientUserId: opts.recipientUserId || null,
                  weekStart: opts.weekStart || null,
                  threadRootMessageId,
                },
              },
              resolve: batchResolve,
              reject: batchReject,
            });
          });
          batchPromises.push(batchPromise);
        }

        // after preparing batches, kick off processing
        // We don't await processQueue here because we want to return the promise that waits for the batches
        setImmediate(() => {
          processQueue().catch((err) => console.error('Queue processing error:', err));
        });

        // Wait for all batches to complete
        await Promise.all(batchPromises);
        resolve('Emails processed successfully');
      } catch (prepErr) {
        reject(prepErr);
      }
    })();
  });
};

const sendSummaryNotification = async (recipientEmail, summary) => {
  const emailContent = `
  <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 30px;">
    <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
      <!-- Header -->
      <div style="background-color: #a8d42e; text-align: center; padding: 20px;">
        <img src="https://onecommunityglobal.org/wp-content/uploads/2023/05/One-Community-Horizontal-Homepage-Header-980x140px-2.png" alt="One Community Logo" style="max-width: 400px; margin-bottom: 10px;" />
      </div>

      <!-- Message content -->
      <div style="padding: 30px;">
        <h2 style="color: #2d572c;">📬 You have unread messages today</h2>
        <ul style="font-size: 15px; padding-left: 20px; color: #333;">
          ${summary}
        </ul>
      </div>

      <!-- Footer -->
      <div style="background-color: #f0f0f0; padding: 15px; text-align: center; font-size: 13px; color: #666;">
        © One Community — Built for the Highest Good of All
      </div>
    </div>
  </div>
`;

  try {
    await sendEmail({
      from: config.email,
      to: recipientEmail,
      subject: `Unread Messages Summary`,
      html: emailContent,
    });
  } catch (error) {
    console.error(`❌ Failed to send summary email to ${recipientEmail}:`, error);
  }
};

emailSender.sendSummaryNotification = sendSummaryNotification;
module.exports = emailSender;
