const express = require('express');
const educationTaskReviewController = require('../controllers/educationTaskReviewController');

const router = express.Router();
const controller = educationTaskReviewController();

router.get('/review/:submissionId', controller.getSubmissionForReview);
router.post('/review/:submissionId/progress', controller.saveReviewProgress);
router.post('/review/:submissionId/comments', controller.addPageComment);
router.put('/review/:submissionId/comments/:commentId', controller.updatePageComment);
router.delete('/review/:submissionId/comments/:commentId', controller.deletePageComment);
router.post('/review/:submissionId/submit', controller.submitFinalReview);

module.exports = router;
