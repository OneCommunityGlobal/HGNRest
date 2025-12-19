const express = require('express');
const mongoose = require('mongoose');
const UserStateCatalog = require('../models/userStateCatalog');
const UserStateSelection = require('../models/userStateSelection');

const router = express.Router();

const slugify = s =>
  String(s || '').toLowerCase().replace(/[^a-z0-9\s]+/g, '').trim().replace(/\s+/g, '-');

const toHex = v => {
  const s = String(v || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s;
  if (/^[0-9a-fA-F]{6}$/.test(s)) return `#${s}`;
  const map = {
    red: '#e74c3c',
    blue: '#2980b9',
    purple: '#8e44ad',
    green: '#27ae60',
    orange: '#e67e22',
    gray: '#7f8c8d',
  };
  return map[s.toLowerCase()] || '#3498db';
};

let catalogCache = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

async function loadActiveCatalog() {
  const now = Date.now();
  if (catalogCache && now - cacheTime < CACHE_TTL) return catalogCache;
  catalogCache = await UserStateCatalog.find({ isActive: true }).sort({ order: 1 }).lean();
  cacheTime = now;
  return catalogCache;
}

function requireManageUserState(req, res, next) {

  return next();
}

router.get('/catalog', async (req, res) => {
  try {
    const items = await loadActiveCatalog();
    return res.json({ items });
  } catch (e) {
    console.error('Catalog fetch failed:', e.message);
    return res.status(500).json({ error: 'server error' });
  }
});

router.post('/catalog', requireManageUserState, async (req, res) => {
  try {
    const { label, color } = req.body || {};
    if (!label || typeof label !== 'string' || !label.trim()) {
      return res.status(400).json({ error: 'label is required' });
    }
    if (label.length > 30) {
      return res.status(400).json({ error: 'label must be ≤ 30 chars' });
    }

    const key = slugify(label);
    const exists = await UserStateCatalog.findOne({
      $or: [{ key }, { label: new RegExp(`^${label}$`, 'i') }],
    }).lean();
    if (exists) return res.status(409).json({ error: 'label/key already exists' });

    const max = await UserStateCatalog.findOne().sort({ order: -1 }).lean();
    const nextOrder = max ? max.order + 1 : 0;

    const item = await UserStateCatalog.create({
      key,
      label,
      color: toHex(color),
      order: nextOrder,
      isActive: true,
    });

    catalogCache = null; // invalidate cache
    return res.status(201).json({ item });
  } catch (e) {
    console.error('Catalog create failed:', e.message);
    return res.status(500).json({ error: 'server error' });
  }
});

router.get('/users/:userId/state-indicators', async (req, res) => {
  const { userId } = req.params;
  if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ error: 'invalid userId' });

  try {
    const [doc, activeCatalog] = await Promise.all([
      UserStateSelection.findOne({ userId }).lean(),
      loadActiveCatalog(),
    ]);

    if (!doc) return res.json({ selectionsByUserId: { [userId]: [] } });

    let selections = Array.isArray(doc.selections) ? doc.selections : [];
    if ((!selections || selections.length === 0) && Array.isArray(doc.stateIndicators)) {
      const inferredDate = doc.updatedAt || doc.createdAt || new Date();
      selections = doc.stateIndicators.map(k => ({ key: k, assignedAt: inferredDate }));
    }

    const orderPos = new Map(activeCatalog.map((c, i) => [c.key, i]));
    selections.sort((a, b) => (orderPos.get(a.key) ?? 9999) - (orderPos.get(b.key) ?? 9999));

    return res.json({ selectionsByUserId: { [userId]: selections } });
  } catch (e) {
    console.error('User selection fetch failed:', e.message);
    return res.status(500).json({ error: 'server error' });
  }
});

router.get('/users/state-indicators', async (req, res) => {
  const raw = String(req.query.ids || '').trim();
  if (!raw) return res.status(400).json({ error: 'ids query param is required' });

  const ids = raw.split(',').map(s => s.trim()).filter(Boolean);
  const validIds = ids.filter(mongoose.isValidObjectId);
  if (!validIds.length) return res.status(400).json({ error: 'no valid ids' });

  try {
    const [docs, activeCatalog] = await Promise.all([
      UserStateSelection.find({ userId: { $in: validIds } }).lean(),
      loadActiveCatalog(),
    ]);

    const orderPos = new Map(activeCatalog.map((c, i) => [c.key, i]));
    const map = Object.fromEntries(validIds.map(id => [id, []]));

    for (const doc of docs) {
      let selections = Array.isArray(doc.selections) ? doc.selections : [];
      if ((!selections || selections.length === 0) && Array.isArray(doc.stateIndicators)) {
        const inferredDate = doc.updatedAt || doc.createdAt || new Date();
        selections = doc.stateIndicators.map(k => ({ key: k, assignedAt: inferredDate }));
      }
      selections.sort((a, b) => (orderPos.get(a.key) ?? 9999) - (orderPos.get(b.key) ?? 9999));
      map[String(doc.userId)] = selections;
    }

    return res.json({ selectionsByUserId: map });
  } catch (e) {
    console.error('Batch state fetch failed:', e.message);
    return res.status(500).json({ error: 'server error' });
  }
});

router.patch('/users/state-indicators', requireManageUserState, async (req, res) => {
  const { updates } = req.body || {};
  if (!Array.isArray(updates) || !updates.length) {
    return res.status(400).json({ error: 'updates[] is required' });
  }

  const rows = updates
    .map(u => ({ userId: u?.userId, selectedKeys: Array.isArray(u?.selectedKeys) ? u.selectedKeys : [] }))
    .filter(u => mongoose.isValidObjectId(u.userId));

  if (!rows.length) return res.status(400).json({ error: 'no valid updates' });

  try {
    const active = await loadActiveCatalog();
    const activeMap = Object.fromEntries(active.map(c => [c.key, c]));
    const activeOrder = active.map(c => c.key);

    // 🔧 fetch existing selections once
    const existingDocs = await UserStateSelection.find({
      userId: { $in: rows.map(r => r.userId) },
    }).lean();
    const existingMap = Object.fromEntries(existingDocs.map(d => [String(d.userId), d]));

    const bulkOps = [];

    for (const row of rows) {
      const set = new Set();
      for (const k of row.selectedKeys) {
        if (!activeMap[k]) return res.status(400).json({ error: `invalid key: ${k}` });
        set.add(k);
      }

      const normalized = activeOrder.filter(k => set.has(k));
      if (normalized.length > 10) return res.status(400).json({ error: 'too many selections (max 10)' });

      const now = new Date();
      const existing = existingMap[row.userId];
      const existingDates = new Map(
        (existing?.selections || []).map(s => [s.key, s.assignedAt])
      );

      const selections = normalized.map(k => ({
        key: k,
        assignedAt: existingDates.get(k) || now,
      }));

      bulkOps.push({
        updateOne: {
          filter: { userId: row.userId },
          update: { $set: { selections } },
          upsert: true,
        },
      });
    }

    if (bulkOps.length) await UserStateSelection.bulkWrite(bulkOps, { ordered: true });

    const saved = await UserStateSelection.find({
      userId: { $in: rows.map(r => r.userId) },
    }).lean();

    const out = Object.fromEntries(saved.map(s => [String(s.userId), s.selections || []]));
    return res.json({ selectionsByUserId: out });
  } catch (e) {
    console.error('UserState bulk update failed:', e.message);
    return res.status(500).json({ error: 'server error' });
  }
});

module.exports = router;
