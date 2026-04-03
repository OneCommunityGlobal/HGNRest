const mongoose = require('mongoose');
const UserStateCatalog = require('../models/userStateCatalog');
const UserStateSelection = require('../models/userStateSelection');

const ALLOWED_COLORS = [
  '#3498db',
  '#27ae60',
  '#9b59b6',
  '#e67e22',
  '#e74c3c',
  '#16a085',
  '#2c3e50',
  '#e91e8c',
  '#f1c40f',
  '#3f51b5',
  '#00bcd4',
  '#795548',
  '#8bc34a',
  '#673ab7',
  '#607d8b',
];

const slugify = (s) =>
  s
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
    .toLowerCase()
    .replaceAll(/[^a-z0-9\s]+/gu, '')
    .trim()
    .replaceAll(/\s+/gu, '-');

const generateKey = (label) => {
  const base = slugify(label);
  const suffix = Math.random().toString(36).slice(2, 6);
  return base ? `${base}-${suffix}` : suffix;
};

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
    const { label, color, emoji } = req.body || {};
    if (!label || typeof label !== 'string') {
      return res.status(400).json({ error: 'label is required' });
    }
    if (label.length > 30) {
      return res.status(400).json({ error: 'label must be ≤ 30 chars' });
    }

    const key = generateKey(label);

    const max = await UserStateCatalog.findOne().sort({ order: -1 }).lean();
    const nextOrder = max ? max.order + 1 : 0;

    const safeLabel = [...label]
      .filter((c) => c.codePointAt(0) >= 32 && c.codePointAt(0) !== 127)
      .join('')
      .slice(0, 30);

    const safeColor = ALLOWED_COLORS.includes(color)
      ? color
      : ALLOWED_COLORS[nextOrder % ALLOWED_COLORS.length];

    const safeEmoji =
      typeof emoji === 'string'
        ? [...emoji]
            .filter((c) => /\p{Emoji_Presentation}|\p{Extended_Pictographic}/u.test(c))
            .join('')
            .slice(0, 2)
        : '';

    const escapedLabel = escapeRegex(safeLabel);
    const clash = await UserStateCatalog.findOne({
      label: { $regex: `^${escapedLabel}$`, $options: 'i' },
      emoji: safeEmoji,
      isActive: true,
    }).lean();

    if (clash) {
      return res.status(409).json({ error: 'A state with this label and emoji already exists' });
    }

    const item = await UserStateCatalog.create({
      key: String(key),
      label: String(safeLabel),
      emoji: String(safeEmoji),
      color: String(safeColor),
      order: Number(nextOrder),
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
        updateOne: { filter: { key: { $eq: k } }, update: { $set: { order: i } } },
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

  const key = sanitizeKey(req.params.key);
  if (!key) return res.status(400).json({ error: 'invalid key' });

  const { label, color, emoji, isActive } = req.body || {};

  const safeEmoji =
    typeof emoji === 'string'
      ? [...emoji]
          .filter((c) => /\p{Emoji_Presentation}|\p{Extended_Pictographic}/u.test(c))
          .join('')
          .slice(0, 2)
      : null;

  try {
    const safeKeyParam = String(key);
    const item = await UserStateCatalog.findOne({ key: { $eq: safeKeyParam } });
    if (!item) return res.status(404).json({ error: 'not found' });

    if (typeof label === 'string') {
      const trimmed = label.trim();
      if (!trimmed) return res.status(400).json({ error: 'label cannot be empty' });
      if (trimmed.length > 30) return res.status(400).json({ error: 'label must be ≤ 30 chars' });

      const escapedTrimmed = escapeRegex(trimmed);
      const clash = await UserStateCatalog.findOne({
        _id: { $ne: item._id },
        label: { $regex: `^${escapedTrimmed}$`, $options: 'i' },
        emoji: safeEmoji !== null ? safeEmoji : item.emoji,
        isActive: true,
      }).lean();
      if (clash)
        return res.status(409).json({ error: 'A state with this label and emoji already exists' });

      item.label = trimmed;
    }

    if (typeof color === 'string' && ALLOWED_COLORS.includes(color)) {
      item.color = color;
    }

    if (typeof emoji === 'string') {
      item.emoji = safeEmoji; // already computed above
    }

    if (typeof isActive === 'boolean') {
      item.isActive = isActive;
      if (!isActive) {
        await UserStateSelection.updateMany(
          { 'stateIndicators.key': key },
          { $pull: { stateIndicators: { key } } },
        );
      }
    }

    await item.save();
    return res.json({ item });
  } catch (updateError) {
    return res.status(500).json({ error: 'db error', details: updateError.message });
  }
};

const getCatalogItemUsage = async (req, res) => {
  if (!checkManage(req)) return res.status(403).json({ error: 'Forbidden' });

  const { key } = req.params;
  if (!key) return res.status(400).json({ error: 'key is required' });

  try {
    const count = await UserStateSelection.countDocuments({
      'stateIndicators.key': key,
    });
    return res.json({ key, count });
  } catch (err) {
    return res.status(500).json({ error: 'db error', details: err.message });
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

const getBatchUserSelections = async (req, res) => {
  const { userIds } = req.body || {};

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ error: 'userIds must be a non-empty array' });
  }

  // Most users (managers, mentors) have small teams (10-50 members) so this is fast.
  // Owners/Admins may have 1000+ users — pagination should be implemented for that case - will handle later on
  if (userIds.length > 3000) {
    return res
      .status(400)
      .json({ error: `too many userIds (max 300), received: ${userIds.length}` });
  }

  // Validate each as a proper ObjectId before hitting the DB
  const validIds = userIds.map((id) => parseUserId(id)).filter(Boolean);
  if (validIds.length === 0) {
    return res.status(400).json({ error: 'no valid userIds provided' });
  }

  try {
    const docs = await UserStateSelection.find(
      { userId: { $in: validIds } },
      'userId stateIndicators',
    ).lean();

    // Shape into { [userId]: stateIndicators[] } for easy lookup on the frontend
    const selections = {};
    for (const doc of docs) {
      selections[String(doc.userId)] = doc.stateIndicators || [];
    }

    return res.json({ selections });
  } catch (batchError) {
    return res.status(500).json({ error: 'db error', details: batchError.message });
  }
};

module.exports = {
  listCatalog,
  createCatalog,
  reorderCatalog,
  updateCatalog,
  getCatalogItemUsage,
  getUserSelections,
  setUserSelections,
  getBatchUserSelections,
};
