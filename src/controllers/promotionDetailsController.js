const mongoose = require('mongoose');
const PromotionDetail = require('../models/promotionDetail');

const promotionDetails = async (req, res) => {
  try {
    const { reviewerId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(reviewerId)) {
      return res.status(400).json({ error: 'Invalid reviewer ID' });
    }

    const promotionDetail = await PromotionDetail.findOne({ _id: reviewerId }).lean();
    if (!promotionDetail) {
      return res.status(404).json({ error: 'Promotion details not found' });
    }

    const { _id, __v, ...cleaned } = promotionDetail;

    if (Array.isArray(cleaned.weeklyPRs)) {
      cleaned.weeklyPRs = cleaned.weeklyPRs.map(({ _id: prId, ...pr }) => pr);
    }
    return res.status(200).json(cleaned);
  } catch (error) {
    console.error('Error fetching promotion details:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = () => ({
  promotionDetails,
});
