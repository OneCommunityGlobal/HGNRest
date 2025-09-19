// summaryDashboard.controller.js
const service = require('../services/summaryDashboard.service');

// Get latest metrics snapshot
exports.getMetrics = async (req, res) => {
  try {
    const snapshot = await service.getAllMetrics();
    if (!snapshot) {
      return res.status(404).json({ message: 'No metrics found' });
    }
    res.json(snapshot);
  } catch (err) {
    console.error('Error in getMetrics:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get material cost trends
exports.getMaterialCosts = async (req, res) => {
  try {
    const data = await service.getMaterialCostTrends();
    res.json(data);
  } catch (err) {
    console.error('Error in getMaterialCosts:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Force refresh / seed snapshot
// exports.refreshMetrics = async (req, res) => {
//   try {
//     const snapshot = await service.forceRefresh();
//     res.json(snapshot);
//   } catch (err) {
//     console.error('Error in refreshMetrics:', err);
//     res.status(500).json({ message: 'Server error' });
//   }
// };

// Get metric history
exports.getHistory = async (req, res) => {
  try {
    const { startDate, endDate, metric } = req.query;
    if (!startDate || !endDate || !metric) {
      return res.status(400).json({ message: 'Missing parameters' });
    }

    const history = await service.getHistory(startDate, endDate, metric);
    res.json(history);
  } catch (err) {
    console.error('Error in getHistory:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
