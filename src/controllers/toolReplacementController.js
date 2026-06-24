const ToolReplacement = require('../models/toolReplacement');

const toolReplacementController = function () {
  const getToolReplacement = async (req, res) => {
    try {
      const { startDate, endDate, tools } = req.query;

      const query = {};

      if (startDate) query.date = { $gte: new Date(startDate) };
      if (endDate) query.date = { ...query.date, $lte: new Date(endDate) };

      if (tools && tools.length > 0) {
        query.toolName = { $in: tools.split(',') };
      }

      return res.status(200).json(await ToolReplacement.find(query).sort({ date: 1 }));
    } catch (error) {
      console.error('Error fetching tool replacement data: ', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };

  return {
    getToolReplacement,
  };
};

module.exports = toolReplacementController;
