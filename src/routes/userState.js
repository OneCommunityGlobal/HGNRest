const express = require('express');
const mongoose = require('mongoose');

const UserStateCatalog = require('../models/userStateCatalog');
const UserStateSelection = require('../models/userStateSelection');

const router = express.Router();
const slugify = s =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, '')
    .trim()
    .replace(/\s+/g, '-');

const toHex = nameOrHex => {
  const v = String(nameOrHex || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v;
  if (/^[0-9a-fA-F]{6}$/.test(v)) return `#${v}`;
  const map = {
    red: '#e74c3c',
    blue: '#2980b9',
    purple: '#8e44ad',
    green: '#27ae60',
    orange: '#e67e22',
    gray: '#7f8c8d',
  };
  return map[v.toLowerCase()] || '#2980b9'; 
};

const loadActiveCatalog = async () =>
  UserStateCatalog.find({ isActive: true }).sort({ order: 1 }).lean();

function requireManageUserState(req, res, next) {
  return next();
}

router.get('/catalog', async (req, res) => {
  try {
    const items = await loadActiveCatalog();
    return res.json({ items });
  } catch (e) {
    return res.status(500).json({ error: 'db error' });
  }
});

router.post('/catalog', requireManageUserState, async (req, res) => {
  try {
    const { label, color } = req.body || {};
    if (!label || typeof label !== 'string') {
      return res.status(400).json({ error: 'label is required' });
    }
    if (label.trim().length === 0) {
      return res.status(400).json({ error: 'label cannot be empty' });
    }
    if (label.length > 30) {
      return res.status(400).json({ error: 'label must be ≤ 30 chars' });
    }

    const key = slugify(label);
    if (!key) {
      return res.status(400).json({ error: 'label produced empty key' });
    }

    const exists = await UserStateCatalog.findOne({
      $or: [{ key }, { label: new RegExp(`^${label}$`, 'i') }],
    }).lean();

    if (exists) {
      return res.status(409).json({ error: 'label/key already exists' });
    }

    const max = await UserStateCatalog.findOne().sort({ order: -1 }).lean();
    const nextOrder = max ? max.order + 1 : 0;

    const item = await UserStateCatalog.create({
      key,
      label,
      color: toHex(color),
      order: nextOrder,
      isActive: true,
    });

    return res.status(201).json({ item });
  } catch (e) {
    return res.status(500).json({ error: 'db error' });
  }
});

router.patch('/catalog/reorder', requireManageUserState, async (req, res) => {
  const { orderedKeys } = req.body || {};
  if (!Array.isArray(orderedKeys)) {
    return res.status(400).json({ error: 'orderedKeys must be array' });
  }

  try {
    const docs = await UserStateCatalog.find({}, 'key').lean();
    const existing = new Set(docs.map(d => d.key));

    if (orderedKeys.length !== docs.length || !orderedKeys.every(k => existing.has(k))) {
      return res.status(400).json({ error: 'orderedKeys must match catalog keys' });
    }

    await UserStateCatalog.bulkWrite(
      orderedKeys.map((k, i) => ({
        updateOne: { filter: { key: k }, update: { $set: { order: i } } },
      }))
    );

    const items = await UserStateCatalog.find().sort({ order: 1 }).lean();
    return res.json({ items });
  } catch (e) {
    return res.status(500).json({ error: 'db error' });
  }
});

router.patch('/catalog/:key', requireManageUserState, async (req, res) => {
  const { key } = req.params;
  const { label, isActive, color } = req.body || {};

  try {
    const item = await UserStateCatalog.findOne({ key });
    if (!item) return res.status(404).json({ error: 'not found' });

    if (typeof label === 'string') {
      const trimmed = label.trim();
      if (!trimmed) return res.status(400).json({ error: 'label cannot be empty' });
      if (trimmed.length > 30) return res.status(400).json({ error: 'label must be ≤ 30 chars' });

      const clash = await UserStateCatalog.findOne({
        _id: { $ne: item._id },
        label: new RegExp(`^${trimmed}$`, 'i'),
      }).lean();

      if (clash) return res.status(409).json({ error: 'label already exists' });
      item.label = trimmed;
    }

    if (typeof isActive === 'boolean') {
      item.isActive = isActive;
    }

    if (typeof color === 'string') {
      item.color = toHex(color);
    }

    await item.save();
    return res.json({ item });
  } catch (e) {
    return res.status(500).json({ error: 'db error' });
  }
});

router.get('/users/:userId/state-indicators', async (req, res) => {
  const { userId } = req.params;

  if (!mongoose.isValidObjectId(userId)) {
    return res.status(400).json({ error: 'invalid userId' });
  }

  try {
    const [doc, activeCatalog] = await Promise.all([
      UserStateSelection.findOne({ userId }).lean(),
      loadActiveCatalog(),
    ]);

    if (!doc) {
      return res.json({ userId, selections: [] });
    }

    if (!doc.selections?.length && Array.isArray(doc.stateIndicators) && doc.stateIndicators.length) {
      const inferredDate = doc.updatedAt || doc.createdAt || new Date();
      const selections = doc.stateIndicators.map(k => ({ key: k, assignedAt: inferredDate }));
      return res.json({ userId, selections });
    }

    const order = activeCatalog.map(c => c.key);
    const orderPos = new Map(order.map((k, i) => [k, i]));

    const selectionsSorted = (doc.selections || [])
      .slice()
      .sort((a, b) => (orderPos.get(a.key) ?? 9999) - (orderPos.get(b.key) ?? 9999));

    return res.json({ userId, selections: selectionsSorted });
  } catch (e) {
    return res.status(500).json({ error: 'db error' });
  }
});

router.patch('/users/:userId/state-indicators', requireManageUserState, async (req, res) => {
  const { userId } = req.params;
  const { selectedKeys } = req.body || {};

  if (!mongoose.isValidObjectId(userId)) {
    return res.status(400).json({ error: 'invalid userId' });
  }
  if (!Array.isArray(selectedKeys)) {
    return res.status(400).json({ error: 'selectedKeys must be array' });
  }

  try {
    const active = await loadActiveCatalog();
    const activeMap = Object.fromEntries(active.map(c => [c.key, c]));

    const set = new Set();
    for (const k of selectedKeys) {
      if (!activeMap[k] || activeMap[k].isActive === false) {
        return res.status(400).json({ error: `invalid or inactive key: ${k}` });
      }
      set.add(k);
    }

    const normalizedKeys = active.map(c => c.key).filter(k => set.has(k));
    if (normalizedKeys.length > 10) {
      return res.status(400).json({ error: 'too many selections (max 10)' });
    }

    const existing = await UserStateSelection.findOne({ userId });
    const existingDates = new Map();

    if (existing?.selections?.length) {
      for (const s of existing.selections) existingDates.set(s.key, s.assignedAt);
    } else if (Array.isArray(existing?.stateIndicators)) {
      const inferred = existing.updatedAt || existing.createdAt || new Date();
      for (const k of existing.stateIndicators) existingDates.set(k, inferred);
    }

    const now = new Date();
    const nextSelections = normalizedKeys.map(k => ({
      key: k,
      assignedAt: existingDates.get(k) || now,
    }));

    const saved = await UserStateSelection.findOneAndUpdate(
      { userId },
      { $set: { selections: nextSelections } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    return res.json({ userId, selections: saved.selections || [] });
  } catch (e) {
    return res.status(500).json({ error: 'db error' });
  }
});

module.exports = router;
