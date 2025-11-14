const express = require('express');
const mongoose = require('mongoose');
const UserStateCatalog = require('../models/userStateCatalog');
const UserStateSelection = require('../models/userStateSelection');

const router = express.Router();

const slugify = s => String(s || '').toLowerCase().replace(/[^a-z0-9\s]+/g, '').trim().replace(/\s+/g, '-');

const toHex = v => {
  const s = String(v || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s;
  if (/^[0-9a-fA-F]{6}$/.test(s)) return `#${s}`;
  const map = { red:'#e74c3c', blue:'#2980b9', purple:'#8e44ad', green:'#27ae60', orange:'#e67e22', gray:'#7f8c8d' };
  return map[s.toLowerCase()] || '#2980b9';
};

const loadActiveCatalog = async () =>
  UserStateCatalog.find({ isActive: true }).sort({ order: 1 }).lean();

function requireManageUserState(req, res, next) {
  // plug your real auth here; for now allow through
  return next();
}

/* ---------- Catalog endpoints (unchanged behavior) ---------- */

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
    if (!label || typeof label !== 'string') return res.status(400).json({ error: 'label is required' });
    if (label.trim().length === 0) return res.status(400).json({ error: 'label cannot be empty' });
    if (label.length > 30) return res.status(400).json({ error: 'label must be ≤ 30 chars' });

    const key = slugify(label);
    if (!key) return res.status(400).json({ error: 'label produced empty key' });

    const exists = await UserStateCatalog.findOne({ $or: [{ key }, { label: new RegExp(`^${label}$`, 'i') }] }).lean();
    if (exists) return res.status(409).json({ error: 'label/key already exists' });

    const max = await UserStateCatalog.findOne().sort({ order: -1 }).lean();
    const nextOrder = max ? max.order + 1 : 0;

    const item = await UserStateCatalog.create({ key, label, color: toHex(color), order: nextOrder, isActive: true });
    return res.status(201).json({ item });
  } catch (e) {
    return res.status(500).json({ error: 'db error' });
  }
});

router.patch('/catalog/reorder', requireManageUserState, async (req, res) => {
  const { orderedKeys } = req.body || {};
  if (!Array.isArray(orderedKeys)) return res.status(400).json({ error: 'orderedKeys must be array' });

  try {
    const docs = await UserStateCatalog.find({}, 'key').lean();
    const existing = new Set(docs.map(d => d.key));
    if (orderedKeys.length !== docs.length || !orderedKeys.every(k => existing.has(k))) {
      return res.status(400).json({ error: 'orderedKeys must match catalog keys' });
    }
    await UserStateCatalog.bulkWrite(orderedKeys.map((k, i) => ({ updateOne: { filter: { key: k }, update: { $set: { order: i } } } })));
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
      const clash = await UserStateCatalog.findOne({ _id: { $ne: item._id }, label: new RegExp(`^${trimmed}$`, 'i') }).lean();
      if (clash) return res.status(409).json({ error: 'label already exists' });
      item.label = trimmed;
    }
    if (typeof isActive === 'boolean') item.isActive = isActive;
    if (typeof color === 'string') item.color = toHex(color);
    await item.save();
    return res.json({ item });
  } catch (e) {
    return res.status(500).json({ error: 'db error' });
  }
});

/* ---------- Single-user endpoints (kept for compatibility) ---------- */

router.get('/users/:userId/state-indicators', async (req, res) => {
  const { userId } = req.params;
  if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ error: 'invalid userId' });

  try {
    const [doc, activeCatalog] = await Promise.all([
      UserStateSelection.findOne({ userId }).lean(),
      loadActiveCatalog(),
    ]);

    if (!doc) return res.json({ userId, selections: [] });

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
  if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ error: 'invalid userId' });
  if (!Array.isArray(selectedKeys)) return res.status(400).json({ error: 'selectedKeys must be array' });

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
    if (normalizedKeys.length > 10) return res.status(400).json({ error: 'too many selections (max 10)' });

    const existing = await UserStateSelection.findOne({ userId });
    const existingDates = new Map();
    if (existing?.selections?.length) {
      for (const s of existing.selections) existingDates.set(s.key, s.assignedAt);
    } else if (Array.isArray(existing?.stateIndicators)) {
      const inferred = existing.updatedAt || existing.createdAt || new Date();
      for (const k of existing.stateIndicators) existingDates.set(k, inferred);
    }

    const now = new Date();
    const nextSelections = normalizedKeys.map(k => ({ key: k, assignedAt: existingDates.get(k) || now }));
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

/* ---------- NEW: Batch endpoints ---------- */

/**
 * GET /api/user-states/users/state-indicators?ids=<id1,id2,...>
 * Returns: { selectionsByUserId: { "<id>": [{key,assignedAt}, ...], ... } }
 */
router.get('/users/state-indicators', async (req, res) => {
  const raw = String(req.query.ids || '').trim();
  if (!raw) return res.status(400).json({ error: 'ids query param is required' });

  const ids = raw.split(',').map(s => s.trim()).filter(Boolean);
  const validIds = ids.filter(mongoose.isValidObjectId);
  if (!validIds.length) return res.status(400).json({ error: 'no valid ids' });
  if (validIds.length > 500) return res.status(400).json({ error: 'too many ids (max 500)' });

  try {
    const [docs, activeCatalog] = await Promise.all([
      UserStateSelection.find({ userId: { $in: validIds } }).lean(),
      loadActiveCatalog(),
    ]);

    const order = activeCatalog.map(c => c.key);
    const orderPos = new Map(order.map((k, i) => [k, i]));

    const map = Object.create(null);
    for (const id of validIds) map[id] = []; // ensure missing users appear with []

    for (const doc of docs) {
      if (!doc) continue;

      let selections = Array.isArray(doc.selections) ? doc.selections : [];
      if ((!selections || selections.length === 0) && Array.isArray(doc.stateIndicators) && doc.stateIndicators.length) {
        const inferredDate = doc.updatedAt || doc.createdAt || new Date();
        selections = doc.stateIndicators.map(k => ({ key: k, assignedAt: inferredDate }));
      }

      const sorted = (selections || []).slice()
        .sort((a, b) => (orderPos.get(a.key) ?? 9999) - (orderPos.get(b.key) ?? 9999));

      map[String(doc.userId)] = sorted;
    }

    return res.json({ selectionsByUserId: map });
  } catch (e) {
    return res.status(500).json({ error: 'db error' });
  }
});

/**
 * PATCH /api/user-states/users/state-indicators
 * Body: { updates: [{ userId, selectedKeys: string[] }, ...] }
 */
router.patch('/users/state-indicators', requireManageUserState, async (req, res) => {
  const { updates } = req.body || {};
  if (!Array.isArray(updates) || !updates.length) {
    return res.status(400).json({ error: 'updates[] is required' });
  }

  const rows = updates
    .map(u => ({ userId: u?.userId, selectedKeys: Array.isArray(u?.selectedKeys) ? u.selectedKeys : [] }))
    .filter(u => mongoose.isValidObjectId(u.userId));

  if (!rows.length) return res.status(400).json({ error: 'no valid updates' });
  if (rows.length > 500) return res.status(400).json({ error: 'too many updates (max 500)' });

  try {
    const active = await loadActiveCatalog();
    const activeMap = Object.fromEntries(active.map(c => [c.key, c]));
    const activeOrder = active.map(c => c.key);

    const makeNormalized = async (userId, keys) => {
      const set = new Set();
      for (const k of keys) {
        if (!activeMap[k] || activeMap[k].isActive === false) return { error: `invalid or inactive key: ${k}` };
        set.add(k);
      }
      const normalizedKeys = activeOrder.filter(k => set.has(k));
      if (normalizedKeys.length > 10) return { error: 'too many selections (max 10)' };

      const existing = await UserStateSelection.findOne({ userId });
      const existingDates = new Map();
      if (existing?.selections?.length) {
        for (const s of existing.selections) existingDates.set(s.key, s.assignedAt);
      } else if (Array.isArray(existing?.stateIndicators)) {
        const inferred = existing.updatedAt || existing.createdAt || new Date();
        for (const k of existing.stateIndicators) existingDates.set(k, inferred);
      }
      const now = new Date();
      return {
        selections: normalizedKeys.map(k => ({ key: k, assignedAt: existingDates.get(k) || now })),
      };
    };

    const bulkOps = [];
    for (const row of rows) {
      const norm = await makeNormalized(row.userId, row.selectedKeys);
      if (norm.error) return res.status(400).json({ error: norm.error });
      bulkOps.push({
        updateOne: {
          filter: { userId: row.userId },
          update: { $set: { selections: norm.selections } },
          upsert: true,
        },
      });
    }

    if (bulkOps.length) await UserStateSelection.bulkWrite(bulkOps, { ordered: true });

    // return fresh values
    const saved = await UserStateSelection.find({ userId: { $in: rows.map(r => r.userId) } }).lean();
    const out = Object.create(null);
    for (const s of saved) out[String(s.userId)] = s.selections || [];
    return res.json({ selectionsByUserId: out });
  } catch (e) {
    return res.status(500).json({ error: 'db error' });
  }
});

module.exports = router;
