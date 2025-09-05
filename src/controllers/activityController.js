const { v4: uuidv4 } = require('uuid');

const activities = [
  {
    _id: '1',
    title: 'Test Event',
    description: 'test event for rescheduling',
    date: '2025-02-23T12:00:00Z',
    organizerId: 'org1',
    participants: [
      { userId: '1', name: 'Alice', email: 'alice@gmail.com' },
      { userId: '2', name: 'Bob',   email: 'bob@gmail.com' },
      { userId: '3', name: 'Jane',  email: 'jane@gmail.com' },
    ],
  },
];

function getActivity(activityId) {
  return activities.find((a) => a._id === activityId);
}

async function sendEmail({ to, subject, html }) {
  // Node Mailer code
  console.log(`[MOCK EMAIL] → ${to}\nSUBJECT: ${subject}\n${html}\n`);
}

exports.rescheduleNotify = async (req, res) => {
  try {
    const { activityId } = req.params;
    const activity = getActivity(activityId);
    if (!activity) return res.status(404).json({ message: 'Activity not found' });

    const { options, reason = '', timezone = 'UTC' } = req.body || {};

    // Validate options
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
      if (!/^\d{4}-\d{2}-\d{2}$/.test(o.dateISO)) {
        return res.status(400).json({ message: 'dateISO must be YYYY-MM-DD' });
      }
      if (!/^\d{2}:\d{2}$/.test(o.start) || !/^\d{2}:\d{2}$/.test(o.end)) {
        return res.status(400).json({ message: 'start/end must be HH:MM (24h)' });
      }
    }

    const participants = activity.participants || [];
    if (participants.length === 0) {
      return res.json({ message: 'No participants to notify', notified: 0 });
    }

    // Build email content
    const subject = `Reschedule notice for “${activity.title}”`;
    const optionsHtml = options.map((o, i) => `<li>${i + 1}. ${(o)}</li>`).join('');
    const reasonHtml = reason ? `<p><strong>Reason:</strong> ${reason}</p>` : '';
    const html = `
      <p>Hello,</p>
      <p>The organizer is proposing new date/time option(s) for <strong>${activity.title}</strong>.</p>
      ${reasonHtml}
      <p>Proposed option(s):</p>
      <ol>${optionsHtml}</ol>
      <p>Time zone: ${timezone}</p>
      <p>Thank you!</p>
    `;

    for (const p of participants) {
      if (p.email) {
        await sendEmail({ to: p.email, subject, html });
      }
    }

    return res.json({
      message: 'Reschedule notification sent',
      activityId,
      notified: participants.length,
      options,
      reason,
      timezone,
      dispatchId: uuidv4(), 
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err?.message || err });
  }
};
