const mongoose = require("mongoose");
const Educator = require("../models/pmEducators");
const PMNotification = require("../models/pmNotification");

const sanitizeMessage = (msg) => String(msg || "").replace(/\s+/g, " ").trim();

const normalizeRecipients = async ({ educatorIds, all }) => {
  let raw = Array.isArray(educatorIds) ? educatorIds : [];
  if (all === true) {
    const ids = await Educator.find().distinct("_id");
    raw = ids.map(String);
  }
  const cleaned = Array.from(new Set(raw.map((id) => String(id || "").trim()).filter((id) => id)));
  const validObjs = cleaned.filter((id) => mongoose.isValidObjectId(id)).map((id) => new mongoose.Types.ObjectId(id));
  const found = await Educator.find({ _id: { $in: validObjs } }).select("_id").lean();
  const foundSet = new Set(found.map((d) => String(d._id)));
  const validIds = cleaned.filter((id) => foundSet.has(id));
  const unknownIds = cleaned.filter((id) => !foundSet.has(id));
  return { validIds, unknownIds, attempted: cleaned.length };
};

const previewNotification = async (req, res) => {
  try {
    const { educatorIds, all, message } = req.body || {};
    const msg = sanitizeMessage(message);
    if (!msg) return res.status(400).json({ error: "message is required" });
    if (msg.length > 1000) return res.status(400).json({ error: "message must be ≤ 1000 characters" });

    const { validIds, unknownIds, attempted } = await normalizeRecipients({ educatorIds, all });
    if (attempted === 0 && all !== true) return res.status(400).json({ error: "Provide at least one educatorId or set all=true" });

    res.json({
      ok: true,
      summary: { attempted, willSendTo: validIds.length, unknownIds, validIds },
      message: msg,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to preview notification" });
  }
};

const sendNotification = async (req, res) => {
  try {
    const { educatorIds, all, message } = req.body || {};
    const msg = sanitizeMessage(message);
    if (!msg) return res.status(400).json({ error: "message is required" });
    if (msg.length > 1000) return res.status(400).json({ error: "message must be ≤ 1000 characters" });

    const { validIds, unknownIds, attempted } = await normalizeRecipients({ educatorIds, all });
    if (attempted === 0 && all !== true) return res.status(400).json({ error: "Provide at least one educatorId or set all=true" });
    if (validIds.length === 0) return res.status(400).json({ error: "No valid educatorIds provided", unknownIds });

    const doc = await PMNotification.create({
      message: msg,
      educatorIds: validIds,
      createdBy: req.user?._id || undefined,
    });

    res.status(201).json({
      ok: true,
      notification: {
        id: String(doc._id),
        message: doc.message,
        educatorIds: doc.educatorIds.map(String),
        createdAt: doc.createdAt.toISOString(),
      },
      summary: { attempted, sentTo: validIds.length, unknownIds, all: all === true },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to send notification" });
  }
};

module.exports = {
  previewNotification,
  sendNotification,
};
