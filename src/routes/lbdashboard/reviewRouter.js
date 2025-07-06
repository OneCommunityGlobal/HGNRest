const express = require('express');
const multer = require('multer');
const router = express.Router();
const reviewController = require('../../controllers/lbdashboard/reviewController');

// Configure multer for in-memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.get('/reviews/:unitId', reviewController.fetchReviews);
router.post('/reviews/submit', upload.array('images', 5), reviewController.submitReview); // Allow up to 5 images

module.exports = router;