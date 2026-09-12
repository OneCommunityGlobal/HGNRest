const OwnerMessageLog = require('../models/ownerMessageLog');

module.exports = () => ({
  getOwnerMessageLogs: async (req, res) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;

    const skip = (page - 1) * limit;
    try {
      const ownerMessageLogs = await OwnerMessageLog.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
      const total = await OwnerMessageLog.countDocuments();
      res.json({
        data: ownerMessageLogs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
});
