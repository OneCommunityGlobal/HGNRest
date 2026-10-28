const mongoose = require('mongoose');
const Educator = require('../models/pmEducators');
const PMNotification = require('../models/pmNotification');

const isObjId = (s) => /^[a-f0-9]{24}$/i.test(String(s || ''));
const sanitizeMessage = (msg) =>
  String(msg || '')
    .replace(/\s+/g, ' ')
    .trim();

async function resolveRecipients(educatorIds = [], all = false) {
  const raw = Array.isArray(educatorIds) ? educatorIds.map(String).filter(Boolean) : [];

  const anyNonObjectId = raw.some((id) => !isObjId(id));
  if (anyNonObjectId) {
    return {
      mode: 'mock',
      attempted: raw.length || (all ? 1 : 0),
      validIds: raw,
      unknownIds: [],
    };
  }

  // Real mode
  const totalEducators = await Educator.estimatedDocumentCount();

  if (all === true) {
    if (totalEducators === 0) {
      return { mode: 'real', attempted: 0, validIds: [], unknownIds: [] };
    }
    const ids = await Educator.find().distinct('_id');
    return { mode: 'real', attempted: ids.length, validIds: ids.map(String), unknownIds: [] };
  }

  const asObjIds = raw.map((id) => new mongoose.Types.ObjectId(id));
  const found = asObjIds.length
    ? await Educator.find({ _id: { $in: asObjIds } })
        .select('_id')
        .lean()
    : [];
  const foundSet = new Set(found.map((d) => String(d._id)));
  const validIds = raw.filter((id) => foundSet.has(id));
  const unknownIds = raw.filter((id) => !foundSet.has(id));

  return { mode: 'real', attempted: raw.length, validIds, unknownIds };
}

const MAX_MESSAGE_LENGTH = 1000;

// Shared by previewNotification and sendNotification: validates the message,
// resolves recipients, and reports the first validation failure (if any).
async function validateAndResolveRequest(body) {
  const { educatorIds, all, message } = body || {};
  const msg = sanitizeMessage(message);

  if (!msg) {
    return { error: { status: 400, body: { error: 'message is required' } } };
  }
  if (msg.length > MAX_MESSAGE_LENGTH) {
    return {
      error: {
        status: 400,
        body: { error: `message must be ≤ ${MAX_MESSAGE_LENGTH} characters` },
      },
    };
  }

  const { mode, attempted, validIds, unknownIds } = await resolveRecipients(educatorIds, all);
  if (attempted === 0 && all !== true) {
    return {
      error: { status: 400, body: { error: 'Provide at least one educatorId or set all=true' } },
    };
  }

  return { msg, mode, attempted, validIds, unknownIds, all: !!all };
}

async function previewNotification(req, res) {
  try {
    const result = await validateAndResolveRequest(req.body);
    if (result.error) return res.status(result.error.status).json(result.error.body);

    const { mode, attempted, validIds, unknownIds, msg, all } = result;
    return res.json({
      ok: true,
      mode,
      summary: { attempted, willSendTo: validIds.length, unknownIds, all },
      message: msg,
    });
  } catch (err) {
    console.error('previewNotification error:', err);
    res.status(500).json({ error: 'Failed to preview notification' });
  }
}

async function sendNotification(req, res) {
  try {
    const result = await validateAndResolveRequest(req.body);
    if (result.error) return res.status(result.error.status).json(result.error.body);

    const { mode, attempted, validIds, unknownIds, msg, all } = result;

    if (mode === 'mock') {
      return res.status(201).json({
        ok: true,
        mode: 'mock',
        notification: {
          id: null,
          message: msg,
          educatorIds: validIds,
          createdAt: new Date().toISOString(),
        },
        summary: { attempted, sentTo: validIds.length, unknownIds, all },
      });
    }

    if (validIds.length === 0) {
      return res.status(400).json({ error: 'No valid educatorIds provided', unknownIds });
    }

    const doc = await PMNotification.create({
      message: msg,
      educatorIds: validIds.map((id) => new mongoose.Types.ObjectId(id)),
      createdBy: req.user?._id || undefined,
    });

    return res.status(201).json({
      ok: true,
      mode: 'real',
      notification: {
        id: String(doc._id),
        message: doc.message,
        educatorIds: doc.educatorIds.map(String),
        createdAt: doc.createdAt.toISOString(),
      },
      summary: { attempted, sentTo: validIds.length, unknownIds, all },
    });
  } catch (err) {
    console.error('sendNotification error:', err);
    res.status(500).json({ error: 'Failed to send notification' });
  }
}

module.exports = {
  previewNotification,
  sendNotification,
};
