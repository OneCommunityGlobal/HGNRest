const prGradingConfigController = function (PRGradingConfig) {
  const getAllConfigs = async (req, res) => {
    try {
      const configs = await PRGradingConfig.find().sort({ createdAt: -1 });
      res.status(200).json(configs);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch configurations', details: err.message });
    }
  };

  const createConfig = async (req, res) => {
    try {
      const { teamName, reviewerCount, testDataType, reviewerNames, notes } = req.body;

      if (!teamName || !reviewerCount || !testDataType) {
        return res
          .status(400)
          .json({ error: 'teamName, reviewerCount, and testDataType are required.' });
      }

      if (typeof reviewerCount !== 'number' || reviewerCount < 1) {
        return res.status(400).json({ error: 'reviewerCount must be a positive number.' });
      }

      const existing = await PRGradingConfig.findOne({ teamName: teamName.trim() });
      if (existing) {
        return res
          .status(409)
          .json({ error: `A configuration with team name "${teamName}" already exists.` });
      }

      const newConfig = new PRGradingConfig({
        teamName: teamName.trim(),
        reviewerCount,
        testDataType,
        reviewerNames: reviewerNames || [],
        notes: notes || '',
      });

      const saved = await newConfig.save();
      res.status(201).json(saved);
    } catch (err) {
      res.status(500).json({ error: 'Failed to create configuration', details: err.message });
    }
  };

  const deleteConfig = async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await PRGradingConfig.findByIdAndDelete(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Configuration not found.' });
      }
      res.status(200).json({ message: 'Configuration deleted successfully.' });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete configuration', details: err.message });
    }
  };

  return { getAllConfigs, createConfig, deleteConfig };
};

module.exports = prGradingConfigController;
