const toolReplacementController = function () {
  const getToolReplacement = (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const query = {};

      if (startDate) query.date = { $gte: new Date(startDate) };
      if (endDate) query.date = { ...query.date, $lte: new Date(endDate) };

      return res.status(201).json([
        { toolName: 'Tool A', requirementSatisfiedPercentage: 30 },
        { toolName: 'Tool B', requirementSatisfiedPercentage: 45 },
      ]);
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
