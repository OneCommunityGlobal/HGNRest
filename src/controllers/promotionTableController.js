const userProfile = require('../models/userProfile');
const { hasPermission } = require('../utilities/permissions');

const promotionTableController = async (req, res) => {
  try {
    const requester = req.user;

    if (!hasPermission(requester, 'viewPromotionEligibility')) {
      return res.status(403).json({ error: 'Forbidden: insufficient permissions' });
    }

    const users = await userProfile.find({ isActive: true });

    const eligibilityData = users.map((user) => {
      const requiredPRs = 5;
      const totalReviews = user.weeklyReviewCount || 0;
      const remainingWeeks = Math.max(0, 4 - (user.weeksMetRequirement || 0));
      const promote = totalReviews >= requiredPRs && remainingWeeks === 0;

      return {
        id: user._id,
        reviewer: user.name || user.username || 'Unnamed',
        hasMetWeekly: user.weeklyStatusMet || false,
        requiredPRs,
        totalReviews,
        remainingWeeks,
        promote,
        isNew: user.isNewMember || false,
      };
    });

    return res.json(eligibilityData);
  } catch (error) {
    console.error('Failed to fetch promotion eligibility:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

module.exports = promotionTableController;
