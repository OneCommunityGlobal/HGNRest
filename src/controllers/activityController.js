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

const PUBLIC_API_ORIGIN = process.env.PUBLIC_API_ORIGIN || 'http://localhost:4500';
const PUBLIC_APP_ORIGIN = process.env.PUBLIC_APP_ORIGIN || 'http://localhost:5173';

const activities = [
  {
    _id: '1',
    title: 'Test Event',
    description: 'test event for rescheduling',
    date: '2025-02-23T12:00:00Z',
    organizerId: 'org1',
    location: 'San Francisco, CA 94108',
    participants: [
      { userId: '1', name: 'Alice', email: 'yelimanvitha@gmail.com' },
      { userId: '2', name: 'Bob', email: 'yelimanvitha@gmail.com' },
      { userId: '3', name: 'Jane', email: 'yelimanvitha@gmail.com' },
    ],
  },
];
function getActivity(activityId) {
  return activities.find((a) => a._id === activityId);
}

const OAuth2Client = new google.auth.OAuth2(
  config.clientId,
  config.clientSecret,
  config.redirectUri
);
OAuth2Client.setCredentials({ refresh_token: config.refreshToken });

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    type: 'OAuth2',
    user: config.email,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
  },
});

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

const RSVP_TOKENS = new Map();
const RSVP_VOTES = new Map();

function buildOptionsListHtml(activityId, token, options, tz) {
  return options.map((o, idx) => {
    const label = `${formatOptionHuman(o, tz)}`;
    const voteUrl =
      `${PUBLIC_API_ORIGIN}/api/communityportal/activities/${activityId}/reschedule/vote` +
      `?token=${encodeURIComponent(token)}&opt=${idx}`;
    return `
      <li style="margin:10px 0; list-style:none;">
        <a href="${voteUrl}"
           style="text-decoration:none; color:#1a1a1a; display:inline-flex; align-items:center;">
          <span style="
            width:16px;height:16px;border:2px solid #666;border-radius:50%;
            display:inline-block;margin-right:10px; box-sizing:border-box;"></span>
          <span>${label}</span>
        </a>
      </li>
    `;
  }).join('');
}

async function rescheduleNotify(req, res) {
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

    const toList = (activity.participants || []).map(p => p.email).filter(Boolean);
    if (toList.length === 0) {
      return res.json({ message: 'No valid participant emails', notified: 0 });
    }

    const prevWhen = moment(activity.date).tz(timezone);
    const prevDateLine = `${prevWhen.format('ddd, MMM D, YYYY')} • ${prevWhen.format('h:mm A')} (${timezone})`;

    for (const email of toList) {
      const token = uuidv4();
      RSVP_TOKENS.set(token, { activityId, email });

      const optionsListHtml = buildOptionsListHtml(activityId, token, options, timezone);

      const rsvpAppUrl =
        `${PUBLIC_APP_ORIGIN}/rsvp?token=${encodeURIComponent(token)}&a=${encodeURIComponent(activityId)}`;

      const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.45;color:#222;">
      <h2 style="margin:0 0 8px;">Reschedule Notice: ${activity.title}</h2>
      <p style="margin:0 0 4px;"><strong>Location:</strong> ${activity.location || 'TBA'}</p>
      <p style="margin:0 0 12px;"><strong>Previously scheduled for:</strong> ${prevDateLine}</p>
      ${reason ? `<p style="margin:8px 0 0"><strong>Reason:</strong> ${reason}</p>` : ''}

      <p style="margin:16px 0 6px;">Choose any of the new time(s) below (you can click multiple):</p>
      <ol style="margin:0 0 16px 20px; padding:0;">${optionsListHtml}</ol>

      <div style="margin:20px 0;">
        <!-- Primary CTA: opens your app where you can show REAL radio buttons + Submit -->
        <a href="${rsvpAppUrl}"
           style="display:inline-block;background:#1a73e8;color:#fff;text-decoration:none;
                  padding:10px 16px;border-radius:6px;font-weight:600;">
          Open poll to review & submit
        </a>
      </div>

      <p style="color:#555;margin-top:12px;">
        Tip: If the “Select this option” links don’t work in your email app, use the button above.
      </p>
    </div>
  `;

      await sendEmail({ to: email, subject: `Reschedule notice for “${activity.title}”`, html });
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
    // eslint-disable-next-line no-console
    console.error('Error in rescheduleNotify:', err);
    return res.status(500).json({ message: 'Server error', error: err?.message || err });
  }
}

function voteReschedule(req, res) {
  const { activityId } = req.params;
  const { token, opt } = req.query;

  if (!token || typeof opt === 'undefined') {
    return res.status(400).send('Missing token or opt');
  }

  const payload = RSVP_TOKENS.get(token);
  if (!payload || payload.activityId !== activityId) {
    return res.status(400).send('Invalid or expired token');
  }

  const optionIdx = Number(opt);
  if (Number.isNaN(optionIdx) || optionIdx < 0) {
    return res.status(400).send('Invalid option index');
  }

  const key = `${activityId}:${payload.email}`;
  if (!RSVP_VOTES.has(key)) RSVP_VOTES.set(key, new Set());
  RSVP_VOTES.get(key).add(optionIdx);

  res.set('Content-Type', 'text/html').send(`
    <!doctype html>
    <html>
      <head><meta charset="utf-8"><title>Thanks!</title></head>
      <body style="font-family:Arial;max-width:600px;margin:40px auto;line-height:1.5;">
        <h2>Thanks! Your selection was recorded.</h2>
        <p>You can click more than one option in the email if multiple times work for you.</p>
      </body>
    </html>
  `);
}


module.exports = {
  rescheduleNotify,
  voteReschedule,
};
