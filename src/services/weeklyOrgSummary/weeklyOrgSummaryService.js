/* eslint-disable no-console */
const moment = require('moment-timezone');
const UserProfile = require('../../models/userProfile');
const Settings = require('../../models/weeklyOrgSummarySettings');
const Run = require('../../models/weeklyOrgSummaryRun');
const emailSender = require('../../utilities/emailSender');
const { renderOrgSummaryPdfs } = require('../../utilities/orgSummaryPdf');
const { buildReportPeriods, getRunKey, formatReportDate } = require('./periods');
const { DEFAULT_SETTINGS, isDue, getScheduledFor, getNextSend } = require('./schedule');

const MAX_ATTEMPTS = 3;
const DUPLICATE_KEY_ERROR = 11000;
const RECENT_RUNS_LIMIT = 10;
const LEASE_MINUTES = 30;
const REPLY_TO = 'onecommunity@gmail.com';
const MESSAGE =
  'Please find attached the weekly, monthly and annual comparison reports for One Community as an organization.';

const getSettings = async () => {
  const doc = await Settings.findOne({ key: 'default' }).lean();
  return { ...DEFAULT_SETTINGS, alertRecipients: [], ...(doc || {}) };
};

// Same recipients as Reports > Weekly Summaries Reports > Weekly Summary Report Recipients.
const getRecipients = async () => {
  const users = await UserProfile.find({ getWeeklyReport: true }, { email: 1 }).lean();
  return [...new Set(users.map((u) => u.email).filter(Boolean))];
};

const getAdminEmails = async () => {
  const admins = await UserProfile.find({ jobTitle: 'Administrator', isActive: true }, { email: 1 }).lean();
  return admins.map((a) => a.email).filter(Boolean);
};

// Atomically claims the run for this week. Returns the run document when this caller owns
// it, or null when it was already sent, is being sent by another instance, or has used
// all its attempts. The unique runKey index makes the insert race-safe across instances.
const claimRun = async (runKey, { trigger, scheduledFor, now }) => {
  const leaseUntil = moment(now).add(LEASE_MINUTES, 'minutes').toDate();
  try {
    return await Run.create({
      runKey,
      status: 'running',
      trigger,
      attempts: 1,
      scheduledFor,
      startedAt: now,
      leaseUntil,
    });
  } catch (err) {
    if (err.code !== DUPLICATE_KEY_ERROR) throw err;
  }
  return Run.findOneAndUpdate(
    {
      runKey,
      attempts: { $lt: MAX_ATTEMPTS },
      $or: [{ status: 'failed' }, { status: 'running', leaseUntil: { $lt: now } }],
    },
    {
      $set: { status: 'running', trigger, startedAt: now, leaseUntil, error: null },
      $inc: { attempts: 1 },
    },
    { new: true },
  );
};

const sendFailureAlert = async (run, settings, error) => {
  try {
    const admins = await getAdminEmails();
    const to = [...new Set([...admins, ...(settings.alertRecipients || [])])];
    if (!to.length) return;
    await emailSender(
      to,
      `Total Org Summary email failed for week of ${run.runKey}`,
      `<p>The weekly Total Org Summary email for the week starting ${run.runKey} failed ` +
        `(attempt ${run.attempts} of ${MAX_ATTEMPTS}).</p><p>Error: ${String(error.message || error)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')}</p>` +
        '<p>It will be retried automatically while the send window is open. An admin can also ' +
        'trigger it from the Total Org Summary email settings.</p>',
      null,
      null,
      REPLY_TO,
    );
    await Run.updateOne({ _id: run._id }, { $set: { alertSentAt: new Date() } });
  } catch (alertErr) {
    console.error('Total Org Summary failure alert could not be sent:', alertErr);
  }
};

/**
 * Sends this week's Total Org Summary email once. Safe to call repeatedly and from several
 * instances: only the caller that claims the run does the work.
 */
const runWeeklyOrgSummary = async ({ trigger = 'schedule', now = new Date() } = {}) => {
  const settings = await getSettings();
  const runKey = getRunKey(now, settings.timezone);
  const run = await claimRun(runKey, {
    trigger,
    scheduledFor: getScheduledFor(now, settings),
    now,
  });
  if (!run) return { status: 'skipped', runKey };

  try {
    const recipients = await getRecipients();
    if (!recipients.length) throw new Error('No Weekly Summary Report recipients are configured');

    const periods = buildReportPeriods(now, settings.timezone);
    const dateLabel = formatReportDate(now, settings.timezone);
    const pdfs = await renderOrgSummaryPdfs(periods);
    const attachments = pdfs.map(({ period, buffer }) => ({
      filename: `${dateLabel} ${period.label} report.pdf`,
      content: buffer,
      contentType: 'application/pdf',
    }));
    const subject = `Total Org Summary Reports for ${dateLabel}`;

    const result = await emailSender(
      recipients,
      subject,
      `<p>${MESSAGE}</p>`,
      attachments,
      null,
      REPLY_TO,
    );
    // emailSender short-circuits outside production or when sendEmail is off
    const delivered = !(typeof result === 'string' && result.startsWith('EMAIL_SENDING_DISABLED'));

    await Run.updateOne(
      { _id: run._id },
      {
        $set: {
          status: delivered ? 'sent' : 'disabled',
          finishedAt: new Date(),
          recipients,
          subject,
          attachments: attachments.map((a) => a.filename),
          error: null,
        },
      },
    );
    return { status: delivered ? 'sent' : 'disabled', runKey, recipients: recipients.length };
  } catch (err) {
    console.error('Total Org Summary email failed:', err);
    await Run.updateOne(
      { _id: run._id },
      { $set: { status: 'failed', finishedAt: new Date(), error: String(err.message || err) } },
    );
    await sendFailureAlert(run, settings, err);
    return { status: 'failed', runKey, error: String(err.message || err) };
  }
};

// Called by the cron tick: sends when this week's slot is open and nothing has been sent yet.
const runIfDue = async (now = new Date()) => {
  const settings = await getSettings();
  if (!isDue(now, settings)) return { status: 'not-due' };
  return runWeeklyOrgSummary({ trigger: 'schedule', now });
};

const getStatus = async (now = new Date()) => {
  const settings = await getSettings();
  const runKey = getRunKey(now, settings.timezone);
  const [thisWeek, recent, recipients] = await Promise.all([
    Run.findOne({ runKey }).lean(),
    Run.find({}).sort({ runKey: -1 }).limit(RECENT_RUNS_LIMIT).lean(),
    getRecipients(),
  ]);
  return {
    settings,
    nextScheduledSend: getNextSend(now, settings, thisWeek?.status === 'sent'),
    recipientCount: recipients.length,
    recentRuns: recent,
  };
};

module.exports = {
  MAX_ATTEMPTS,
  getSettings,
  getRecipients,
  claimRun,
  runWeeklyOrgSummary,
  runIfDue,
  getStatus,
};
