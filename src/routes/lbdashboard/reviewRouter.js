const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');

router.get('/lbdashboard/reviews/:unitId', reviewController.fetchReviews);
router.post('/lbdashboard/reviews/submit', reviewController.submitReview);

module.exports = router;