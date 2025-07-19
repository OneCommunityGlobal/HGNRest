const userProfile = require('../models/userProfile');
const { hasPermission } = require('../utilities/permissions');

const promotionTableController = function () {
  const reviewForThisWeek = async (req, res) => {
    try {
      const users = await userProfile.find({ isActive: true });

      const result = users.map((user) => {
        const hasMet = user.weeklySummariesCount >= 1; // example condition
        const weeksSinceStart = Math.floor(
          (Date.now() - new Date(user.startDate).getTime()) / (7 * 24 * 60 * 60 * 1000),
        );
        const remainingWeeks = Math.max(0, 4 - weeksSinceStart);
        const eligible = user.isNewMember && hasMet && remainingWeeks <= 0;

        return {
          userId: user._id,
          name: `${user.firstName} ${user.lastName}`,
          reviewer: user.reviewerName || 'Unassigned',
          weeklyStatus: hasMet ? '✓Has Met' : '✕Has not Met',
          requiredPRs: 5,
          totalReviews: user.weeklySummariesCount,
          remainingWeeks,
          promote: eligible,
        };
      });

      res.status(200).json(result);
    } catch (error) {
      console.error('reviewForThisWeek error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  const processPromotions = async (req, res) => {
    try {
      const { promotions } = req.body;

      const promoteOps = promotions
        .filter((p) => p.promote)
        .map((p) =>
          userProfile.findByIdAndUpdate(p.userId, {
            isNewMember: false,
            promotionDate: new Date(),
          }),
        );

      await Promise.all(promoteOps);
      res.status(200).json({ message: 'Users promoted successfully' });
    } catch (error) {
      console.error('processPromotions error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  const getPromotionEligibility = async (req, res) => {
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

  return {
    reviewForThisWeek,
    processPromotions,
    getPromotionEligibility,
  };
};

module.exports = promotionTableController;
