const TimelogTracking = require('../models/timelogTracking');
const logger = require('../startup/logger');

/**
 * Get timelog tracking events for a specific user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getTimelogTracking = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Get the last 100 events for the user, sorted by timestamp descending (most recent first)
    const trackingEvents = await TimelogTracking.find({ userId })
      .sort({ timestamp: -1 })
      .limit(100)
      .populate('userId', 'firstName lastName email timeZone');

    res.status(200).json(trackingEvents);
  } catch (error) {
    logger.logException(error);
    res.status(500).json({ error: 'Failed to fetch timelog tracking events' });
  }
};

module.exports = {
  getTimelogTracking,
};
