const express = require('express');
const formController = require('../controllers/collaborationController');
const { jobApplicationUploadMiddleware } = require('../middleware/jobApplicationUploadMiddleware');
const {
  jobApplicationIpLimiter,
  jobApplicationEmailLimiter,
} = require('../middleware/jobApplicationRateLimit');
const { jobApplicationBotGuard } = require('../middleware/jobApplicationBotGuard');

const router = express.Router();

// Create a new form
router.post('/jobforms', formController.createForm);

router.get('/jobforms/all', formController.getAllFormsFormat);

// Update a form's format
router.put('/jobforms', formController.updateFormFormat);

// Get the format of a specific form
router.get('/jobforms/:formId', formController.getFormFormat);

// Get all responses of a form
router.get('/jobforms/:formId/responses', formController.getFormResponses);

// Submit a job application (public — resume + per-question file uploads, size/type limited)
// Order matters: IP limit before the upload is parsed, then bot checks and the per-email limit
// once the body (honeypot, fillMs, email) is available.
router.post(
  '/jobforms/:formId/responses',
  jobApplicationIpLimiter,
  jobApplicationUploadMiddleware,
  jobApplicationBotGuard,
  jobApplicationEmailLimiter,
  formController.submitFormResponse,
);

// Question management routes
router.post('/jobforms/:formId/questions', formController.addQuestion);
router.patch('/jobforms/:formId/questions/:questionIndex', formController.updateQuestion);
router.delete('/jobforms/:formId/questions/:questionIndex', formController.deleteQuestion);
router.put('/jobforms/:formId/questions/reorder', formController.reorderQuestions);

// Form management routes
router.delete('/jobforms/:formId', formController.deleteForm);

// Question set integration routes
router.post('/jobforms/:formId/import-questions', formController.importQuestionsFromSet);

module.exports = router;
