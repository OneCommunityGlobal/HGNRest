const mongoose = require('mongoose');
const UserStateCatalog = require('../models/userStateCatalog');
const UserStateSelection = require('../models/userStateSelection');

const ALLOWED_COLORS = ['red', 'blue', 'purple', 'green', 'orange'];

// Fix: use replaceAll (L25, L31)
const slugify = (s) =>
  s
    .toLowerCase()
    .replaceAll(/[^a-z0-9\s]+/gu, '')
    .trim()
    .replaceAll(/\s+/gu, '-');

function checkManage(req) {
  const requestor = req.body?.requestor || {};
  return (
    requestor.role === 'Owner' ||
    requestor.role === 'Administrator' ||
    (Array.isArray(requestor.permissions) &&
      requestor.permissions.includes('manage_user_state_indicator'))
  );
}

// Fix: validate userId as a real MongoDB ObjectId — SonarCloud safe
function parseUserId(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

// Fix: whitelist-based key sanitization
function sanitizeKey(key) {
  if (typeof key !== 'string') return null;
  const clean = key.replaceAll(/[^a-z0-9-]/gu, '');
  return clean || null;
}

// Fix: escape user input before using in regex
function escapeRegex(str) {
  return str.replaceAll(/[$()*+.?[\\\]^{|}]/gu, String.raw`\$&`);
}

const listCatalog = async (req, res) => {
  try {
    const items = await UserStateCatalog.find({ isActive: true }).sort({ order: 1 }).lean();
    return res.json({ items });
  } catch (listError) {
    return res.status(500).json({ error: 'db error', details: listError.message });
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

    const escapedLabel = escapeRegex(label);
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

    // Fix L80: whitelist color from user input — never use raw value
    const safeColor = ALLOWED_COLORS.includes(color) ? color : ALLOWED_COLORS[nextOrder % 5];

    const item = await UserStateCatalog.create({
      key,
      label,
      color: safeColor,
      order: nextOrder,
      isActive: true,
    });

    return res.status(201).json({ item });
  } catch (createError) {
    return res.status(500).json({ error: 'db error', details: createError.message });
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

    const sanitizedKeys = orderedKeys.map((k) => sanitizeKey(k)).filter(Boolean);
    await UserStateCatalog.bulkWrite(
      sanitizedKeys.map((k, i) => ({
        updateOne: { filter: { key: k }, update: { $set: { order: i } } },
      })),
    );

    const items = await UserStateCatalog.find({ isActive: true }).sort({ order: 1 }).lean();
    return res.json({ items });
  } catch (reorderError) {
    return res.status(500).json({ error: 'db error', details: reorderError.message });
  }
};

const updateCatalog = async (req, res) => {
  if (!checkManage(req)) return res.status(403).json({ error: 'Forbidden' });

  // Fix L137: sanitize key from params
  const key = sanitizeKey(req.params.key);
  if (!key) return res.status(400).json({ error: 'invalid key' });

  const { label, isActive } = req.body || {};
  try {
    // Use a static query with the sanitized key
    const item = await UserStateCatalog.findOne({ key: { $eq: key } });
    if (!item) return res.status(404).json({ error: 'not found' });

    if (typeof label === 'string') {
      const trimmed = label.trim();
      if (!trimmed) return res.status(400).json({ error: 'label cannot be empty' });
      if (trimmed.length > 30) return res.status(400).json({ error: 'label must be ≤ 30 chars' });

      const escapedTrimmed = escapeRegex(trimmed);
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
  } catch (updateError) {
    return res.status(500).json({ error: 'db error', details: updateError.message });
  }
};

const getUserSelections = async (req, res) => {
  // Fix L172: validate userId as ObjectId — SonarCloud safe
  const userId = parseUserId(req.params.userId);
  if (!userId) return res.status(400).json({ error: 'invalid userId' });

  try {
    const doc = await UserStateSelection.findOne({ userId: { $eq: userId } }).lean();
    return res.json({ userId, stateIndicators: doc?.stateIndicators || [] });
  } catch (getError) {
    return res.status(500).json({ error: 'db error', details: getError.message });
  }
};

const setUserSelections = async (req, res) => {
  if (!checkManage(req)) return res.status(403).json({ error: 'Forbidden' });

  // Fix L205, L218: validate userId as ObjectId — SonarCloud safe
  const userId = parseUserId(req.params.userId);
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

    const existing = await UserStateSelection.findOne({ userId: { $eq: userId } }).lean();
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
      { userId: { $eq: userId } },
      { $set: { stateIndicators: normalized } },
      { new: true, upsert: true },
    ).lean();

    return res.json({ userId, stateIndicators: doc.stateIndicators });
  } catch (setError) {
    return res.status(500).json({ error: 'db error', details: setError.message });
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
