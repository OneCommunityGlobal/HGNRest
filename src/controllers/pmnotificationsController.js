const { randomUUID } = require("crypto");
const { __getKnownEducatorIds } = require("./pmeducatorsController");

const modify = (msg) => String(msg || "").replace(/\s+/g, " ").trim();

const normalizeRecipients = ({ educatorIds, all }) => {
  const known = new Set(__getKnownEducatorIds());
  let raw = Array.isArray(educatorIds) ? educatorIds : [];
  if (all === true) raw = Array.from(known);

  const cleaned = Array.from(
    new Set(raw.map((id) => String(id || "").trim()).filter((id) => id.length > 0))
  );

  const unknownIds = cleaned.filter((id) => !known.has(id));
  const validIds = cleaned.filter((id) => known.has(id));

  return { validIds, unknownIds, attempted: cleaned.length };
};

const previewNotification = (req, res) => {
  try {
    const { educatorIds, all, message } = req.body || {};
    const msg = modify(message);
    if (!msg) return res.status(400).json({ error: "message is required" });
    if (msg.length > 1000)
      return res.status(400).json({ error: "message must be ≤ 1000 characters" });

    const { validIds, unknownIds, attempted } = normalizeRecipients({ educatorIds, all });
    if (attempted === 0 && all !== true)
      return res
        .status(400)
        .json({ error: "Provide at least one educatorId or set all=true" });

    res.json({
      ok: true,
      summary: {
        attempted,
        willSendTo: validIds.length,
        unknownIds,
        validIds,
      },
      message: msg,
    });
  } catch (err) {
    console.error("previewNotification error:", err);
    res.status(500).json({ error: "Failed to preview notification" });
  }
};

const sendNotification = (req, res) => {
  try {
    const { educatorIds, all, message } = req.body || {};
    const msg = modify(message);
    if (!msg) return res.status(400).json({ error: "message is required" });
    if (msg.length > 1000)
      return res.status(400).json({ error: "message must be ≤ 1000 characters" });

    const { validIds, unknownIds, attempted } = normalizeRecipients({ educatorIds, all });
    if (attempted === 0 && all !== true)
      return res
        .status(400)
        .json({ error: "Provide at least one educatorId or set all=true" });
    if (validIds.length === 0)
      return res.status(400).json({ error: "No valid educatorIds provided", unknownIds });

    const id = randomUUID ? randomUUID() : `notif_${Date.now()}`;
    const createdAt = new Date().toISOString();
    const payload = { id, educatorIds: validIds, message: msg, createdAt };

    res.status(201).json({
      ok: true,
      notification: payload,
      summary: {
        attempted,
        sentTo: validIds.length,
        unknownIds,
        all: all === true,
      },
    });
  } catch (err) {
    console.error("sendNotification error:", err);
    res.status(500).json({ error: "Failed to send notification" });
  }
};

module.exports = {
  previewNotification,
  sendNotification,
};
