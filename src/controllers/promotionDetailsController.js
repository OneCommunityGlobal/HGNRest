const PromotionDetail = require('../models/promotionDetail');

const promotionDetails = async (req, res) => {
  try {
    const { reviewerId } = req.params;
    // Assuming there's a PromotionDetail model to fetch promotion details
    const promotionDetail = await PromotionDetail.findOne({ reviewerId }).lean();
    if (!promotionDetail) {
      return res.status(404).json({ error: 'Promotion details not found' });
    }
    return res.status(200).json(promotionDetail);
  } catch (error) {
    console.error('Error fetching promotion details:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = () => ({
  promotionDetails,
});
