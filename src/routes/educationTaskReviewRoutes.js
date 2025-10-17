const express = require('express');
const educationTaskReviewController = require('../controllers/educationTaskReviewController');

const router = express.Router();
const controller = educationTaskReviewController();

router.get('/review/:submissionId', controller.getSubmissionForReview);

module.exports = router;
