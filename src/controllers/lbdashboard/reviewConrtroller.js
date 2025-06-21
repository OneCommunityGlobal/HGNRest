const Review = require('../models/Review');

const reviewController = {
  // Fetch all reviews for a specific unit
  async fetchReviews(req, res) {
    try {
      const { unitId } = req.params;
      const reviews = await Review.find({ unitId })
        .populate('user', '_id name')
        .sort({ createdAt: -1 });

      res.status(200).json(reviews);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching reviews', error });
    }
  },

  // Submit a new review
  async submitReview(req, res) {
    try {
      const { userId, unitId, text } = req.body;

      const newReview = new Review({
        user: userId,
        unitId,
        text,
      });

      await newReview.save();
      res.status(201).json(newReview);
    } catch (error) {
      res.status(500).json({ message: 'Error submitting review', error });
    }
  },
};

module.exports = reviewController;