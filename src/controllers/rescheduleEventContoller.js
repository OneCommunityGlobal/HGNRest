const { v4: uuidv4 } = require('uuid');
const moment = require('moment-timezone');
const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const mongoose = require('mongoose');
const RescheduleEvent = require('../models/rescheduleEvent');
const UserProfile = require('../models/userProfile');

const config = {
  email: process.env.TEST_EMAIL_ID,
  clientId: process.env.TEST_CLIENT_ID,
  clientSecret: process.env.TEST_CLIENT_SECRET,
  redirectUri: process.env.TEST_REDIRECT_URI,
  refreshToken: process.env.TEST_REFRESH_TOKEN,
};
const isEmailConfigured = () =>
  Boolean(
    config.email &&
      config.clientId &&
      config.clientSecret &&
      config.redirectUri &&
      config.refreshToken,
  );
const PUBLIC_APP_ORIGIN = process.env.PUBLIC_APP_ORIGIN || 'https://www.highestgoodnetwork.org';

const OAuth2Client = new google.auth.OAuth2(
  config.clientId,
  config.clientSecret,
  config.redirectUri,
);
OAuth2Client.setCredentials({ refresh_token: config.refreshToken });

const transporter = nodemailer.createTransport({
  service: 'gmail',
  secure: true,
  auth: {
    type: 'OAuth2',
    user: config.email,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
  },
});

async function sendEmail({ to, subject, html }) {
  if (!isEmailConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('EMAIL_OAUTH_NOT_CONFIGURED');
    }

    console.info(`[reschedule] Email skipped locally for ${to}`);

    return {
      skipped: true,
      to,
    };
  }

  const accessTokenResp = await OAuth2Client.getAccessToken();
  const token = typeof accessTokenResp === 'object' ? accessTokenResp?.token : accessTokenResp;

  if (!token) {
    throw new Error('NO_OAUTH_ACCESS_TOKEN');
  }

  return transporter.sendMail({
    from: config.email,
    to,
    subject,
    html,
    auth: {
      type: 'OAuth2',
      user: config.email,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      refreshToken: config.refreshToken,
      accessToken: token,
    },
  });
}

const isHHMM = (s) => /^\d{2}:\d{2}$/.test(s);
const isYYYYMMDD = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);

const to12h = (hhmm) => {
  const [H, M] = hhmm.split(':').map(Number);
  const ap = H >= 12 ? 'PM' : 'AM';
  const h12 = H % 12 || 12;
  return `${h12}:${String(M).padStart(2, '0')} ${ap}`;
};

function formatOptionHuman({ dateISO, start, end }, tz) {
  const [y, m, d] = dateISO.split('-').map(Number);
  const startMoment = moment.tz(
    { year: y, month: m - 1, day: d, hour: +start.slice(0, 2), minute: +start.slice(3) },
    tz,
  );
  const dateStr = startMoment.format('ddd, MMM D, YYYY');
  return `${dateStr} • ${to12h(start)} – ${to12h(end)} (${tz})`;
}

const RESCHEDULE_POLLS = new Map();

const MOCK_ACTIVITY = {
  _id: '1',
  title: 'Test Event',
  description: 'test event for rescheduling',
  date: '2025-02-23T12:00:00Z',
  organizerId: 'org1',
  location: 'San Francisco, CA 94108',
  participants: [
    { userId: '1', name: 'Alice', email: 'alice@gmail.com' },
    { userId: '2', name: 'Bob', email: 'bob@gmail.com' },
    { userId: '3', name: 'Jane', email: 'jane@gmail.com' },
  ],
};

const isMockActivityId = (activityId) =>
  process.env.NODE_ENV !== 'production' && /^\d+$/.test(String(activityId));

const isSupportedActivityId = (activityId) =>
  isMockActivityId(activityId) || mongoose.isValidObjectId(activityId);

async function loadActivity(activityId) {
  if (isMockActivityId(activityId)) {
    return {
      ...MOCK_ACTIVITY,
      _id: String(activityId),
    };
  }

  if (!mongoose.isValidObjectId(activityId)) return null;

  const act = await RescheduleEvent.findById(activityId).lean();
  return act || null;
}

async function getParticipantEmails(activity) {
  if (!activity?.participants?.length) return [];
  if (activity._id === '1') {
    return activity.participants
      .map((p) => (p && typeof p === 'object' ? p.email : null))
      .filter(Boolean);
  }
  const idsOnly = activity.participants.filter((p) => mongoose.isValidObjectId(p));
  if (!idsOnly.length) {
    return activity.participants
      .map((p) => (p && typeof p === 'object' ? p.email : null))
      .filter(Boolean);
  }
  const users = await UserProfile.find({ _id: { $in: idsOnly } }, { email: 1 }).lean();
  const emails = (users || []).map((u) => u?.email).filter(Boolean);
  if (emails.length) return emails;
  return activity.participants
    .map((p) => (p && typeof p === 'object' ? p.email : null))
    .filter(Boolean);
}

function validateRescheduleOptions(options) {
  if (!Array.isArray(options) || options.length === 0) {
    return 'options[] is required and must be non-empty';
  }
  if (options.length > 5) {
    return 'At most 5 options allowed';
  }
  if (options.some((option) => !option?.dateISO || !option?.start || !option?.end)) {
    return 'Each option must include dateISO, start, end';
  }
  if (options.some((option) => !isYYYYMMDD(option.dateISO))) {
    return 'dateISO must be YYYY-MM-DD';
  }
  if (options.some((option) => !isHHMM(option.start) || !isHHMM(option.end))) {
    return 'start/end must be HH:MM (24h)';
  }
  return null;
}

function buildRescheduleEmail({
  activity,
  activityId,
  activityTitle,
  options,
  prevDateLine,
  reason,
  timezone,
}) {
  const optionsListHtml = options
    .map((option) => formatOptionHuman(option, timezone))
    .map((label) => `<li style="margin:8px 0;">${label}</li>`)
    .join('');

  const rsvpAppUrl = `${PUBLIC_APP_ORIGIN}/communityportal/ReschedulePoll?a=${encodeURIComponent(
    activityId,
  )}`;

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.45;color:#222;">
      <h2 style="margin:0 0 8px;">Reschedule Notice: ${activityTitle}</h2>
      <p><strong>Location:</strong> ${activity.location || 'TBA'}</p>
      <p><strong>Previously scheduled for:</strong> ${prevDateLine}</p>
      ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
      <p>Please review the new times and submit your choice:</p>
      <ul>${optionsListHtml}</ul>
      <div style="margin:20px 0;">
        <a href="${rsvpAppUrl}" style="background:#1a73e8;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:600;">Open poll and submit your choice</a>
      </div>
    </div>
  `;
}

async function rescheduleNotify(req, res) {
  try {
    const { activityId } = req.params;
    if (!isSupportedActivityId(activityId)) {
      return res.status(400).json({ message: 'Invalid activity id' });
    }
    const activity = await loadActivity(activityId);
    if (!activity) return res.status(404).json({ message: 'Activity not found' });

    const { options, reason = '', timezone = 'UTC' } = req.body || {};
    const optionsError = validateRescheduleOptions(options);
    if (optionsError) {
      return res.status(400).json({ message: optionsError });
    }

    const toList = await getParticipantEmails(activity);
    if (toList.length === 0) {
      return res.json({ message: 'No valid participant emails', notified: 0 });
    }

    const dispatchId = uuidv4();
    RESCHEDULE_POLLS.set(activityId, {
      options,
      timezone,
      reason,
      dispatchId,
      createdAt: Date.now(),
      voters: new Set(),
      votes: new Array(options.length).fill(0),
    });

    const prevWhen = moment(activity.date).tz(timezone);
    const prevDateLine = `${prevWhen.format('ddd, MMM D, YYYY')} • ${prevWhen.format('h:mm A')} (${timezone})`;
    const activityTitle = activity.title || activity.name || 'Event';

    let notified = 0;
    let skipped = 0;

    for (const email of toList) {
      const html = buildRescheduleEmail({
        activity,
        activityId,
        activityTitle,
        options,
        prevDateLine,
        reason,
        timezone,
      });

      const result = await sendEmail({
        to: email,
        subject: `Reschedule notice for “${activityTitle}”`,
        html,
      });

      if (result?.skipped) {
        skipped += 1;
      } else {
        notified += 1;
      }
    }

    return res.json({
      message:
        skipped > 0
          ? 'Reschedule poll created; email delivery skipped locally'
          : 'Reschedule notification sent',
      activityId,
      notified,
      skipped,
      emailMode: skipped > 0 ? 'dry-run' : 'sent',
      options,
      reason,
      timezone,
      dispatchId,
    });
  } catch (err) {
    console.error('Error in rescheduleNotify:', err);
    return res.status(500).json({ message: 'Server error', error: err?.message || err });
  }
}

async function getReschedulePoll(req, res) {
  try {
    const { activityId } = req.params;

    // Accept '1' (mock) or a real ObjectId
    if (!isSupportedActivityId(activityId)) {
      return res.status(400).json({ message: 'Invalid activity id' });
    }

    const poll = RESCHEDULE_POLLS.get(activityId);
    if (!poll) return res.status(404).json({ message: 'No active poll for this activity' });

    const activity = await loadActivity(activityId);
    if (!activity) return res.status(404).json({ message: 'Activity not found' });

    // No identification anymore – public read
    return res.json({
      activity: {
        id: activityId,
        title: activity.title || activity.name || 'Event',
        location: activity.location,
        description: activity.description,
      },
      timezone: poll.timezone,
      reason: poll.reason,
      options: poll.options,
    });
  } catch (err) {
    console.error('Error in getReschedulePoll:', err);
    return res.status(500).json({ message: 'Server error', error: err?.message || err });
  }
}

function submitRescheduleVote(req, res) {
  try {
    const { activityId } = req.params;
    const { optionIdx } = req.body || {};

    if (!isSupportedActivityId(activityId)) {
      return res.status(400).json({ message: 'Invalid activity id' });
    }

    const poll = RESCHEDULE_POLLS.get(activityId);
    if (!poll) return res.status(404).json({ message: 'No active poll for this activity' });

    const idx = Number(optionIdx);
    if (!Number.isInteger(idx) || idx < 0 || idx >= poll.options.length) {
      return res.status(400).json({ message: 'Invalid option index' });
    }

    // Lightweight duplicate guard: 1 vote per requestor/IP per activity
    const voterId = req.body.requestor?.requestorId || req.ip || 'unknown';
    const voterKey = `${activityId}:${voterId}`;

    if (!poll.voters) {
      poll.voters = new Set();
    }

    if (!poll.votes) {
      poll.votes = new Array(poll.options.length).fill(0);
    }

    if (poll.voters.has(voterKey)) {
      return res.status(409).json({
        message: 'A vote has already been recorded for this activity',
      });
    }

    poll.voters.add(voterKey);
    poll.votes[idx] += 1;

    return res.json({
      message: 'Vote recorded',
      activityId,
      optionIdx: idx,
    });
  } catch (err) {
    console.error('Error in submitRescheduleVote:', err);
    return res.status(500).json({ message: 'Server error', error: err?.message || err });
  }
}

module.exports = {
  rescheduleNotify,
  getReschedulePoll,
  submitRescheduleVote,
};
