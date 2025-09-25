// routes/userState.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const UserStateSelection = require('../models/userStateSelection'); // selections: [{ key, assignedAt }]

// ----------- In-memory Catalog (you can replace later with DB) -----------
let catalog = [
  { key: 'closing-out',    label: '❌ Closing',         color: 'red',    order: 0, isActive: true },
  { key: 'new-dev',        label: '🖥️ New Developer',   color: 'blue',   order: 1, isActive: true },
  { key: 'pr-review-team', label: '👾 PR Review Team',   color: 'purple', order: 2, isActive: true },
  { key: 'developer',      label: '🖥️✅ Developer',      color: 'green',  order: 3, isActive: true },
];

// ----------- Helpers -----------
const byKey = () => Object.fromEntries(catalog.map(o => [o.key, o]));
const sortByOrder = arr => arr.slice().sort((a, b) => a.order - b.order);
const slugify = (s) =>
  s.toLowerCase().replace(/[^a-z0-9\s]+/g, '').trim().replace(/\s+/g, '-');

function requireManageUserState(req, res, next) {
  const user = req.user || {};
  const has =
    user.role === 'Owner' ||
    (Array.isArray(user.permissions) && user.permissions.includes('manage_user_state_indicator'));
  if (!has) return res.status(403).json({ error: 'Forbidden' });
  next();
}

// ----------- Catalog Endpoints -----------
router.get('/catalog', (req, res) => {
  const active = sortByOrder(catalog.filter(c => c.isActive));
  res.json({ items: active });
});

router.post('/catalog', requireManageUserState, (req, res) => {
  const { label, color } = req.body || {};
  if (!label || typeof label !== 'string') {
    return res.status(400).json({ error: 'label is required' });
  }
  if (label.length > 30) {
    return res.status(400).json({ error: 'label must be ≤ 30 chars' });
  }

  const key = slugify(label);
  if (!key) {
    return res.status(400).json({ error: 'label produced empty key' });
  }
  if (catalog.some(c => c.key === key || c.label.toLowerCase() === label.toLowerCase())) {
    return res.status(409).json({ error: 'label/key already exists' });
  }

  const nextOrder = catalog.length ? Math.max(...catalog.map(c => c.order)) + 1 : 0;
  const newItem = {
    key,
    label,
    color: color || ['red', 'blue', 'purple', 'green', 'orange'][nextOrder % 5],
    order: nextOrder,
    isActive: true,
  };

  catalog.push(newItem);
  res.status(201).json({ item: newItem });
});

router.patch('/catalog/reorder', requireManageUserState, (req, res) => {
  const { orderedKeys } = req.body || {};
  if (!Array.isArray(orderedKeys)) {
    return res.status(400).json({ error: 'orderedKeys must be array' });
  }
  const keysSet = new Set(catalog.map(c => c.key));
  if (orderedKeys.length !== catalog.length || !orderedKeys.every(k => keysSet.has(k))) {
    return res.status(400).json({ error: 'orderedKeys must match catalog keys' });
  }
  const orderMap = new Map(orderedKeys.map((k, i) => [k, i]));
  catalog = catalog.map(c => ({ ...c, order: orderMap.get(c.key) }));
  res.json({ items: sortByOrder(catalog) });
});

router.patch('/catalog/:key', requireManageUserState, (req, res) => {
  const { key } = req.params;
  const { label, isActive } = req.body || {};
  const item = catalog.find(c => c.key === key);
  if (!item) return res.status(404).json({ error: 'not found' });

  if (typeof label === 'string') {
    if (!label.trim()) return res.status(400).json({ error: 'label cannot be empty' });
    if (label.length > 30) return res.status(400).json({ error: 'label must be ≤ 30 chars' });
    const clash = catalog.find(c => c.key !== key && c.label.toLowerCase() === label.toLowerCase());
    if (clash) return res.status(409).json({ error: 'label already exists' });
    item.label = label;
  }

  if (typeof isActive === 'boolean') {
    item.isActive = isActive;
  }

  res.json({ item });
});

// ----------- User Selections (Persisted) -----------
// Return selections with dates
router.get('/users/:userId/state-indicators', async (req, res) => {
  const { userId } = req.params;

  // sanity check for ObjectId
  if (!mongoose.isValidObjectId(userId)) {
    return res.status(400).json({ error: 'invalid userId' });
  }

  const doc = await UserStateSelection.findOne({ userId }).lean();

  if (!doc) {
    return res.json({ userId, selections: [] });
  }

  // Backward-compat: if legacy stateIndicators exists, infer a date
  if (!doc.selections?.length && Array.isArray(doc.stateIndicators) && doc.stateIndicators.length) {
    const inferredDate = doc.updatedAt || doc.createdAt || new Date();
    const selections = doc.stateIndicators.map(k => ({ key: k, assignedAt: inferredDate }));
    // Optionally: do not persist here; just return. First PATCH will migrate.
    return res.json({ userId, selections });
  }

  // Sort by catalog order (nice to have)
  const order = sortByOrder(catalog).map(c => c.key);
  const orderMap = new Map(order.map((k, i) => [k, i]));
  const selectionsSorted = (doc.selections || []).slice().sort(
    (a, b) => (orderMap.get(a.key) ?? 9999) - (orderMap.get(b.key) ?? 9999)
  );

  res.json({ userId, selections: selectionsSorted });
});

// Update selections; keep assignedAt for existing, set now for new
router.patch('/users/:userId/state-indicators', requireManageUserState, async (req, res) => {
  const { userId } = req.params;
  const { selectedKeys } = req.body || {};

  if (!mongoose.isValidObjectId(userId)) {
    return res.status(400).json({ error: 'invalid userId' });
  }
  if (!Array.isArray(selectedKeys)) {
    return res.status(400).json({ error: 'selectedKeys must be array' });
  }

  // validate against active catalog
  const activeMap = byKey();
  const set = new Set();
  for (const k of selectedKeys) {
    if (!activeMap[k] || activeMap[k].isActive === false) {
      return res.status(400).json({ error: `invalid or inactive key: ${k}` });
    }
    set.add(k);
  }

  // keep catalog display order
  const normalizedKeys = sortByOrder(catalog).map(c => c.key).filter(k => set.has(k));

  if (normalizedKeys.length > 10) {
    return res.status(400).json({ error: 'too many selections (max 10)' });
  }

  // fetch existing to preserve dates
  const existing = await UserStateSelection.findOne({ userId });

  let existingDates = new Map();
  if (existing?.selections?.length) {
    for (const s of existing.selections) existingDates.set(s.key, s.assignedAt);
  } else if (Array.isArray(existing?.stateIndicators)) {
    // backward compat: infer timestamps
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

  res.json({ userId, selections: saved.selections || [] });
});

module.exports = router;
