const express = require('express');
const router = express.Router();


let catalog = [
  { key: 'closing-out',    label: '❌ Closing Out',     color: 'red',    order: 0, isActive: true },
  { key: 'new-dev',        label: '🖥️ New Developer',   color: 'blue',   order: 1, isActive: true },
  { key: 'pr-review-team', label: '👾 PR Review Team',   color: 'purple', order: 2, isActive: true },
  { key: 'developer',      label: '🖥️✅ Developer',      color: 'green',  order: 3, isActive: true },
];


const userSelections = new Map();

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

router.patch('/users/:userId/state-indicators', requireManageUserState, (req, res) => {
  const { userId } = req.params;
  const { selectedKeys } = req.body || {};
  if (!Array.isArray(selectedKeys)) {
    return res.status(400).json({ error: 'selectedKeys must be array' });
  }
  const activeMap = byKey();
  const set = new Set();
  for (const k of selectedKeys) {
    if (!activeMap[k] || activeMap[k].isActive === false) {
      return res.status(400).json({ error: `invalid or inactive key: ${k}` });
    }
    set.add(k);
  }
  const normalized = sortByOrder(catalog).map(c => c.key).filter(k => set.has(k));
  if (normalized.length > 10) {
    return res.status(400).json({ error: 'too many selections (max 10)' });
  }
  userSelections.set(userId, normalized);
  res.json({ userId, stateIndicators: normalized });
});

router.get('/users/:userId/state-indicators', (req, res) => {
  const { userId } = req.params;
  res.json({ userId, stateIndicators: userSelections.get(userId) || [] });
});

module.exports = router;
