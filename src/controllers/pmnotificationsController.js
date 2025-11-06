const mongoose = require('mongoose');
const Educator = require('../models/pmEducators');
const PMNotification = require('../models/pmNotification');

const isObjId = (s) => /^[a-f0-9]{24}$/i.test(String(s || ''));
const sanitizeMessage = (msg) => String(msg || '').replace(/\s+/g, ' ').trim();

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
    ? await Educator.find({ _id: { $in: asObjIds } }).select('_id').lean()
    : [];
  const foundSet = new Set(found.map((d) => String(d._id)));
  const validIds = raw.filter((id) => foundSet.has(id));
  const unknownIds = raw.filter((id) => !foundSet.has(id));

  return { mode: 'real', attempted: raw.length, validIds, unknownIds };
}

async function previewNotification(req, res) {
  try {
    const { educatorIds, all, message } = req.body || {};
    const msg = sanitizeMessage(message);
    if (!msg) return res.status(400).json({ error: 'message is required' });
    if (msg.length > 1000) return res.status(400).json({ error: 'message must be ≤ 1000 characters' });

    const { mode, attempted, validIds, unknownIds } = await resolveRecipients(educatorIds, all);
    if (attempted === 0 && all !== true) {
      return res.status(400).json({ error: 'Provide at least one educatorId or set all=true' });
    }

    return res.json({
      ok: true,
      mode,
      summary: { attempted, willSendTo: validIds.length, unknownIds, all: !!all },
      message: msg,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to preview notification' });
  }
}

async function sendNotification(req, res) {
  try {
    const { educatorIds, all, message } = req.body || {};
    const msg = sanitizeMessage(message);
    if (!msg) return res.status(400).json({ error: 'message is required' });
    if (msg.length > 1000) return res.status(400).json({ error: 'message must be ≤ 1000 characters' });

    const { mode, attempted, validIds, unknownIds } = await resolveRecipients(educatorIds, all);
    if (attempted === 0 && all !== true) {
      return res.status(400).json({ error: 'Provide at least one educatorId or set all=true' });
    }

  
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
        summary: { attempted, sentTo: validIds.length, unknownIds, all: !!all },
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
      summary: { attempted, sentTo: validIds.length, unknownIds, all: !!all },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send notification' });
  }
}

module.exports = {
  previewNotification,
  sendNotification,
};
