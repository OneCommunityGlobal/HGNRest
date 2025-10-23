const { randomUUID } = require("crypto");
const KNOWN_EDUCATOR_IDS = new Set(["t-001", "t-002", "t-003"]);

function sanitizeMessage(msg) {
  return String(msg || "").replace(/\s+/g, " ").trim();
}

exports.sendNotification = (req, res) => {
  try {
    let { educatorIds, message } = req.body || {};

    if (!Array.isArray(educatorIds)) {
      return res.status(400).json({ error: "educatorIds must be an array" });
    }
    const cleanedIds = Array.from(
      new Set(
        educatorIds
          .map((id) => String(id || "").trim())
          .filter((id) => id.length > 0)
      )
    );

    if (cleanedIds.length === 0) {
      return res.status(400).json({ error: "Provide at least one educatorId" });
    }
    const unknownIds = cleanedIds.filter((id) => !KNOWN_EDUCATOR_IDS.has(id));
    const validIds = cleanedIds.filter((id) => KNOWN_EDUCATOR_IDS.has(id));

    message = sanitizeMessage(message);
    if (!message) {
      return res.status(400).json({ error: "message is required" });
    }
    if (message.length > 1000) {
      return res.status(400).json({ error: "message must be ≤ 1000 characters" });
    }

    if (validIds.length === 0) {
      return res
        .status(400)
        .json({ error: "No valid educatorIds provided", unknownIds });
    }
    const id = randomUUID ? randomUUID() : `notif_${Date.now()}`;
    const createdAt = new Date().toISOString();
    const payload = { id, educatorIds: validIds, message, createdAt };
    res.status(201).json({
      ok: true,
      notification: payload,
      summary: {
        attempted: cleanedIds.length,
        sentTo: validIds.length,
        unknownIds,
      },
    });
  } catch (err) {
    console.error("sendNotification error:", err);
    res.status(500).json({ error: "Failed to send notification" });
  }
};
