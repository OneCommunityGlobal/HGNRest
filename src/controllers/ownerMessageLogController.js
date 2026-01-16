const OwnerMessageLog = require('../models/ownerMessageLog');

module.exports = () => ({
  getOwnerMessageLogs: async (req, res) => {
    try {
      const ownerMessageLogs = await OwnerMessageLog.find().sort({ createdAt: -1 });
      res.json(ownerMessageLogs);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
});
