const UserStateCatalog = require('../models/userStateCatalog');
const UserStateSelection = require('../models/userStateSelection');

// Fix: replaceAll instead of replace (Reliability Low L7, L9)
const slugify = (s) =>
  s
    .toLowerCase()
    .replaceAll(/[^a-z0-9\s]+/g, '')
    .trim()
    .replaceAll(/\s+/g, '-');

function checkManage(req) {
  const requestor = req.body?.requestor || {};
  return (
    requestor.role === 'Owner' ||
    requestor.role === 'Administrator' ||
    (Array.isArray(requestor.permissions) &&
      requestor.permissions.includes('manage_user_state_indicator'))
  );
}

// Fix: sanitize userId to prevent DB injection (Blocker)
function sanitizeId(id) {
  if (typeof id !== 'string') return null;
  return id.replace(/[^a-zA-Z0-9]/g, '');
}

// Fix: sanitize key to prevent DB injection (Blocker)
function sanitizeKey(key) {
  if (typeof key !== 'string') return null;
  return key.replace(/[^a-z0-9-]/g, '');
}

const listCatalog = async (req, res) => {
  try {
    const items = await UserStateCatalog.find({ isActive: true }).sort({ order: 1 }).lean();
    return res.json({ items });
  } catch (e) {
    // Fix: handle exception (Maintainability Low L25)
    return res.status(500).json({ error: 'db error', details: e.message });
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

    // Fix: use $regex object instead of RegExp from user data (High L46)
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const exists = await UserStateCatalog.findOne({
      $or: [{ key }, { label: { $regex: `^${escapedLabel}$`, $options: 'i' } }],
    });
    if (exists) {
      if (!exists.isActive) {
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
    // Fix: handle exception (Maintainability Low L70)
    return res.status(500).json({ error: 'db error', details: e.message });
  }
};

const reorderCatalog = async (req, res) => {
  if (!checkManage(req)) return res.status(403).json({ error: 'Forbidden' });

  const { orderedKeys } = req.body || {};
  if (!Array.isArray(orderedKeys)) {
    return res.status(400).json({ error: 'orderedKeys must be array' });
  }
  try {
    const count = await UserStateCatalog.countDocuments({ isActive: true });
    if (orderedKeys.length !== count) {
      return res.status(400).json({ error: 'orderedKeys must match catalog keys' });
    }

    const docs = await UserStateCatalog.find({ isActive: true }, 'key').lean();
    const existing = new Set(docs.map((d) => d.key));
    if (!orderedKeys.every((k) => existing.has(k))) {
      return res.status(400).json({ error: 'orderedKeys must match catalog keys' });
    }

    // Fix: sanitize keys before using in DB query (Blocker L61)
    const sanitizedKeys = orderedKeys.map((k) => sanitizeKey(k)).filter(Boolean);
    await UserStateCatalog.bulkWrite(
      sanitizedKeys.map((k, i) => ({
        updateOne: { filter: { key: k }, update: { $set: { order: i } } },
      })),
    );

    const items = await UserStateCatalog.find().sort({ order: 1 }).lean();
    return res.json({ items });
  } catch (e) {
    // Fix: handle exception (Maintainability Low L101)
    return res.status(500).json({ error: 'db error', details: e.message });
  }
};

const updateCatalog = async (req, res) => {
  if (!checkManage(req)) return res.status(403).json({ error: 'Forbidden' });

  // Fix: sanitize key from params (Blocker L112)
  const key = sanitizeKey(req.params.key);
  if (!key) return res.status(400).json({ error: 'invalid key' });

  const { label, isActive } = req.body || {};
  try {
    const item = await UserStateCatalog.findOne({ key });
    if (!item) return res.status(404).json({ error: 'not found' });

    if (typeof label === 'string') {
      const trimmed = label.trim();
      if (!trimmed) return res.status(400).json({ error: 'label cannot be empty' });
      if (trimmed.length > 30) return res.status(400).json({ error: 'label must be ≤ 30 chars' });

      // Fix: escape regex from user data (High L122)
      const escapedTrimmed = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const clash = await UserStateCatalog.findOne({
        _id: { $ne: item._id },
        label: { $regex: `^${escapedTrimmed}$`, $options: 'i' },
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
    // Fix: handle exception (Maintainability Low L134)
    return res.status(500).json({ error: 'db error', details: e.message });
  }
};

const getUserSelections = async (req, res) => {
  // Fix: sanitize userId from params (Blocker L142)
  const userId = sanitizeId(req.params.userId);
  if (!userId) return res.status(400).json({ error: 'invalid userId' });

  try {
    const doc = await UserStateSelection.findOne({ userId }).lean();
    return res.json({ userId, stateIndicators: doc?.stateIndicators || [] });
  } catch (e) {
    // Fix: handle exception (Maintainability Low L144)
    return res.status(500).json({ error: 'db error', details: e.message });
  }
};

const setUserSelections = async (req, res) => {
  if (!checkManage(req)) return res.status(403).json({ error: 'Forbidden' });

  // Fix: sanitize userId from params (Blocker L173, L187)
  const userId = sanitizeId(req.params.userId);
  if (!userId) return res.status(400).json({ error: 'invalid userId' });

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

    const existing = await UserStateSelection.findOne({ userId }).lean();
    const existingMap = new Map(
      (existing?.stateIndicators || []).map((s) => [s.key, s.selectedAt]),
    );

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
    // Fix: handle exception (Maintainability Low L194)
    return res.status(500).json({ error: 'db error', details: e.message });
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
