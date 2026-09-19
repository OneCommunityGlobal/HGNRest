const mongoose = require('mongoose');
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

    // Validate ObjectId format strictly
    const isValidMongoId =
      mongoose.Types.ObjectId.isValid(userId) &&
      String(new mongoose.Types.ObjectId(userId)) === userId;
    if (!isValidMongoId) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    // Enforce access control: user can access own data; Owners/Admins can access others
    const requestor = req.body && req.body.requestor ? req.body.requestor : null;
    if (!requestor || !requestor.requestorId || !requestor.role) {
      return res.status(401).json({ error: 'Unauthorized request' });
    }
    const privilegedRoles = ['Owner', 'Administrator'];
    const isSelfRequest = String(requestor.requestorId) === String(userId);
    const hasPrivilege = privilegedRoles.includes(requestor.role);
    if (!isSelfRequest && !hasPrivilege) {
      return res
        .status(403)
        .json({ error: "Forbidden: Not allowed to view this user's timelog tracking data" });
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
