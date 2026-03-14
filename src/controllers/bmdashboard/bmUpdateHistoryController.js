const UpdateHistory = require('../../models/bmdashboard/updateHistory');

const bmUpdateHistoryController = function () {
  // GET /api/bm/consumables/updateHistory
  const getConsumablesUpdateHistory = async (req, res) => {
    try {
      const history = await UpdateHistory.find({ itemType: 'consumable' })
        .populate('modifiedBy', 'firstName lastName _id')
        .sort({ date: -1 })
        .limit(500);

      // Format response for frontend display
      const formattedHistory = history.map((record) => ({
        _id: record._id,
        date: record.date,
        itemName: record.itemName,
        projectName: record.projectName,
        changes: record.changes,
        modifiedBy: record.modifiedBy,
      }));

      res.status(200).json(formattedHistory);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching update history', error: error.message });
    }
  };

  return {
    getConsumablesUpdateHistory,
  };
};

module.exports = bmUpdateHistoryController;
