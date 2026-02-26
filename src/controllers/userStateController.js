const UserStateCatalog = require('../models/userStateCatalog');
const UserStateSelection = require('../models/userStateSelection');

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, '')
    .trim()
    .replace(/\s+/g, '-');

function checkManage(req) {
  const requestor = req.body?.requestor || {};
  return (
    requestor.role === 'Owner' ||
    requestor.role === 'Administrator' ||
    (Array.isArray(requestor.permissions) &&
      requestor.permissions.includes('manage_user_state_indicator'))
  );
}

const listCatalog = async (req, res) => {
  try {
    const items = await UserStateCatalog.find({ isActive: true }).sort({ order: 1 }).lean();
    return res.json({ items });
  } catch (e) {
    return res.status(500).json({ error: 'db error' });
  }
};

const createCatalog = async (req, res) => {
  if (!checkManage(req)) return res.status(403).json({ error: 'Forbidden' });

  try {
    const { label, color } = req.body || {};
    if (!label || typeof label !== 'string') {
      return res.status(400).json({ error: 'label is required' });
    }
    if (label.length > 30) {
      return res.status(400).json({ error: 'label must be ≤ 30 chars' });
    }

    const key = slugify(label);
    if (!key) return res.status(400).json({ error: 'label produced empty key' });

    const exists = await UserStateCatalog.findOne({
      $or: [{ key }, { label: new RegExp(`^${label}$`, 'i') }],
    });
    if (exists) {
      if (!exists.isActive) {
        // Reactivate instead of erroring
        exists.isActive = true;
        await exists.save();
        return res.status(201).json({ item: exists });
      }
      return res.status(409).json({ error: 'label/key already exists' });
    }

    const max = await UserStateCatalog.findOne().sort({ order: -1 }).lean();
    const nextOrder = max ? max.order + 1 : 0;

    const item = await UserStateCatalog.create({
      key,
      label,
      color: color || ['red', 'blue', 'purple', 'green', 'orange'][nextOrder % 5],
      order: nextOrder,
      isActive: true,
    });

    return res.status(201).json({ item });
  } catch (e) {
    return res.status(500).json({ error: 'db error' });
  }
};

const reorderCatalog = async (req, res) => {
  if (!checkManage(req)) return res.status(403).json({ error: 'Forbidden' });

  const { orderedKeys } = req.body || {};
  if (!Array.isArray(orderedKeys)) {
    return res.status(400).json({ error: 'orderedKeys must be array' });
  }
  try {
    const count = await UserStateCatalog.countDocuments();
    if (orderedKeys.length !== count) {
      return res.status(400).json({ error: 'orderedKeys must match catalog keys' });
    }

    const docs = await UserStateCatalog.find({}, 'key').lean();
    const existing = new Set(docs.map((d) => d.key));
    if (!orderedKeys.every((k) => existing.has(k))) {
      return res.status(400).json({ error: 'orderedKeys must match catalog keys' });
    }
    await UserStateCatalog.bulkWrite(
      orderedKeys.map((k, i) => ({
        updateOne: { filter: { key: k }, update: { $set: { order: i } } },
      })),
    );

    const items = await UserStateCatalog.find().sort({ order: 1 }).lean();
    return res.json({ items });
  } catch (e) {
    return res.status(500).json({ error: 'db error' });
  }
};

const updateCatalog = async (req, res) => {
  if (!checkManage(req)) return res.status(403).json({ error: 'Forbidden' });

  const { key } = req.params;
  const { label, isActive } = req.body || {};
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

    await item.save();
    return res.json({ item });
  } catch (e) {
    return res.status(500).json({ error: 'db error' });
  }
};

const getUserSelections = async (req, res) => {
  const { userId } = req.params;
  try {
    const doc = await UserStateSelection.findOne({ userId }).lean();
    return res.json({ userId, stateIndicators: doc?.stateIndicators || [] });
  } catch (e) {
    return res.status(500).json({ error: 'db error' });
  }
};

const setUserSelections = async (req, res) => {
  if (!checkManage(req)) return res.status(403).json({ error: 'Forbidden' });

  const { userId } = req.params;
  const { selectedKeys } = req.body || {};
  if (!Array.isArray(selectedKeys)) {
    return res.status(400).json({ error: 'selectedKeys must be array' });
  }

  try {
    const active = await UserStateCatalog.find({ isActive: true }, 'key order').lean();
    const activeByKey = new Map(active.map((c) => [c.key, c]));

    for (const k of selectedKeys) {
      if (!activeByKey.has(k)) {
        return res.status(400).json({ error: `invalid or inactive key: ${k}` });
      }
    }

    if (selectedKeys.length > 10) {
      return res.status(400).json({ error: 'too many selections (max 10)' });
    }

    // Get existing doc to preserve dates for already-selected keys
    const existing = await UserStateSelection.findOne({ userId }).lean();
    const existingMap = new Map(
      (existing?.stateIndicators || []).map((s) => [s.key, s.selectedAt]),
    );

    // Build new indicators preserving existing dates, adding new ones with now
    const normalized = active
      .sort((a, b) => a.order - b.order)
      .filter((c) => selectedKeys.includes(c.key))
      .map((c) => ({
        key: c.key,
        selectedAt: existingMap.get(c.key) || new Date(),
      }));

    const doc = await UserStateSelection.findOneAndUpdate(
      { userId },
      { $set: { stateIndicators: normalized } },
      { new: true, upsert: true },
    ).lean();

    return res.json({ userId, stateIndicators: doc.stateIndicators });
  } catch (e) {
    return res.status(500).json({ error: 'db error' });
  }
};

module.exports = {
  listCatalog,
  createCatalog,
  reorderCatalog,
  updateCatalog,
  getUserSelections,
  setUserSelections,
};
