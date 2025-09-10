const { v4: uuidv4 } = require('uuid');
const moment = require('moment-timezone');
const nodemailer = require('nodemailer');
const { google } = require('googleapis');

const config = {
  email: process.env.TEST_EMAIL_ID,
  clientId: process.env.TEST_CLIENT_ID,
  clientSecret: process.env.TEST_CLIENT_SECRET,
  redirectUri: process.env.TEST_REDIRECT_URI,
  refreshToken: process.env.TEST_REFRESH_TOKEN,
};

// Setup OAuth2 client
const OAuth2Client = new google.auth.OAuth2(
  config.clientId,
  config.clientSecret,
  config.redirectUri
);
OAuth2Client.setCredentials({ refresh_token: config.refreshToken });

// Nodemailer transporter 
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    type: 'OAuth2',
    user: config.email,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
  },
});

// Utility to actually send one email
async function sendEmail({ to, subject, html }) {
  const accessTokenResp = await OAuth2Client.getAccessToken();
  const token = typeof accessTokenResp === 'object'
    ? accessTokenResp?.token
    : accessTokenResp;

  if (!token) throw new Error('NO_OAUTH_ACCESS_TOKEN');

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

const activities = [
  {
    _id: '1',
    title: 'Test Event',
    description: 'test event for rescheduling',
    date: '2025-02-23T12:00:00Z',
    organizerId: 'org1',
    location: 'San Francisco, CA 94108',
    participants: [
      { userId: '1', name: 'Alice', email: 'manvithayeeli@gmail.com' },
      { userId: '2', name: 'Bob', email: 'manvithayeeli@gmail.com' },
      { userId: '3', name: 'Jane', email: 'manvithayeeli@gmail.com' },
    ],
  },
];

const RSVP_TOKENS = new Map();
const RSVP_VOTES = new Map();

const PUBLIC_API_ORIGIN = process.env.PUBLIC_API_ORIGIN;
const PUBLIC_APP_ORIGIN = process.env.PUBLIC_APP_ORIGIN;

function buildOptionsListHtml(activityId, token, options, tz) {
  return options.map((o, idx) => {
    const label = `${formatOptionHuman(o, tz)}`;
    const voteUrl = `${PUBLIC_API_ORIGIN}/api/communityportal/activities/${activityId}/reschedule/vote?token=${encodeURIComponent(token)}&opt=${idx}`;
    return `<li>${label} — <a href="${voteUrl}">Select this option</a></li>`;
  }).join('');
}

function getActivity(activityId) {
  return activities.find((a) => a._id === activityId);
}

const isHHMM = (s) => /^\d{2}:\d{2}$/.test(s);
const isYYYYMMDD = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const to12h = (hhmm) => {
  const [H, M] = hhmm.split(':').map(Number);
  const ap = H >= 12 ? 'PM' : 'AM';
  const h12 = (H % 12) || 12;
  return `${h12}:${String(M).padStart(2, '0')} ${ap}`;
};

function formatOptionHuman({ dateISO, start, end }, tz) {
  const [y, m, d] = dateISO.split('-').map(Number);
  const startMoment = moment.tz(
    { year: y, month: m - 1, day: d, hour: +start.slice(0, 2), minute: +start.slice(3) },
    tz
  );
  const dateStr = startMoment.format('ddd, MMM D, YYYY');
  return `${dateStr} • ${to12h(start)} – ${to12h(end)} (${tz})`;
}

exports.rescheduleNotify = async (req, res) => {
  try {
    const { activityId } = req.params;
    const activity = getActivity(activityId);
    if (!activity) return res.status(404).json({ message: 'Activity not found' });

    const { options, reason = '', timezone = 'UTC' } = req.body || {};

    if (!Array.isArray(options) || options.length === 0) {
      return res.status(400).json({ message: 'options[] is required and must be non-empty' });
    }
    if (options.length > 5) {
      return res.status(400).json({ message: 'At most 5 options allowed' });
    }
    for (const o of options) {
      if (!o?.dateISO || !o?.start || !o?.end) {
        return res.status(400).json({ message: 'Each option must include dateISO, start, end' });
      }
      if (!isYYYYMMDD(o.dateISO)) {
        return res.status(400).json({ message: 'dateISO must be YYYY-MM-DD' });
      }
      if (!isHHMM(o.start) || !isHHMM(o.end)) {
        return res.status(400).json({ message: 'start/end must be HH:MM (24h)' });
      }
    }

    const toList = activity.participants.map(p => p.email).filter(Boolean);
    if (toList.length === 0) {
      return res.json({ message: 'No valid participant emails', notified: 0 });
    }

    const prevWhen = moment(activity.date).tz(timezone);
    const prevDateLine = `${prevWhen.format('ddd, MMM D, YYYY')} • ${prevWhen.format('h:mm A')} (${timezone})`;

    const optionsHtml = options.map(
      (o, i) => `<li>${i + 1}. ${formatOptionHuman(o, timezone)}</li>`
    ).join('');

    const html = `
      <div>
        <h2>Reschedule Notice: ${activity.title}</h2>
        <p><strong>Location:</strong> ${activity.location}</p>
        <p><strong>Previously scheduled for:</strong> ${prevDateLine}</p>
        ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
        <p>Below are the proposed new options:</p>
        <ol>${optionsHtml}</ol>
        <p>Thank you!</p>
      </div>
    `;

    for (const email of toList) {
      const token = uuidv4();
      RSVP_TOKENS.set(token, { activityId, email });

      const optionsListHtml = buildOptionsListHtml(activityId, token, options, timezone);

      const html = `
    <div>
      <h2>Reschedule Notice: ${activity.title}</h2>
      <p><strong>Location:</strong> ${activity.location}</p>
      <p><strong>Previously scheduled for:</strong> ${prevDateLine}</p>
      ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
      <p>Select any of the new time(s) below (you can click multiple):</p>
      <ol>${optionsListHtml}</ol>
      <p>If the links don’t work, open this page to choose: 
        <a href="${PUBLIC_APP_ORIGIN}/rsvp?token=${encodeURIComponent(token)}&a=${encodeURIComponent(activityId)}">Open RSVP</a>
      </p>
      <p>Thank you!</p>
    </div>
  `;

      await sendEmail({
        to: email,
        subject: `Reschedule notice for “${activity.title}”`,
        html,
      });
    }


    return res.json({
      message: 'Reschedule notification sent',
      activityId,
      notified: toList.length,
      options,
      reason,
      timezone,
      dispatchId: uuidv4(),
    });
  } catch (err) {
    console.error('Error in rescheduleNotify:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};
