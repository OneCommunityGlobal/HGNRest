const Review = require('../../models/lbdashboard/reviewModel');
const { saveImagestoAzureBlobStorage } = require('../../utilities/AzureBlobImages');

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
      console.error('Error fetching reviews:', error);
      res.status(500).json({ message: 'Error fetching reviews', error: error.message });
    }
  },

  // Submit a new review
  async submitReview(req, res) {
    try {
      const { unitId, text, stars, username } = req.body;
      const userId = req.body.requestor.requestorId;
      let imageUrls = [];

      if (req.files && req.files.length > 0) {
        try {
          // Assuming the title for the blob storage can be a combination of unitId and userId
          const blobTitle = `${unitId}-${userId}-review`;
          imageUrls = await saveImagestoAzureBlobStorage(req.files, blobTitle);
        } catch (azureError) {
          console.error('Error saving images to Azure Blob Storage:', azureError);
          // Decide how to handle this error:
          // 1. Fail the review submission: throw azureError;
          // 2. Submit review without images: continue, but log the error.
          // For now, we'll submit without images and log the error.
        }
      }

      const newReview = new Review({
        user: userId,
        unitId,
        text,
        imageUrls, // This will be an empty array if no images or if Azure upload failed
        stars,
        username,
      });

      await newReview.save();
      res.status(201).json(newReview);
    } catch (error) {
      if (error.code === 11000) { // Duplicate key error
        return res.status(409).json({ message: 'You have already reviewed this unit.' });
      }
      console.error('Error submitting review:', error);
      res.status(500).json({ message: 'Error submitting review', error: error.message });
    }
  },
};

module.exports = reviewController;