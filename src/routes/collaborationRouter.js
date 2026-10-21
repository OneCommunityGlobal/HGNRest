const express = require('express');
const formController = require('../controllers/collaborationController');
const emailRecipientsController = require('../controllers/jobApplicationEmailRecipientsController');
const upload = require('../middleware/multerMiddleware');

const router = express.Router();

// Protected by JWT middleware and controller-level Owner/Admin authorization.
router.get('/job-application-email-recipients', emailRecipientsController.getRecipients);
router.put('/job-application-email-recipients', emailRecipientsController.updateRecipients);

// Create a new form
router.post('/jobforms', formController.createForm);

router.get('/jobforms/all', formController.getAllFormsFormat);

// Update a form's format
router.put('/jobforms', formController.updateFormFormat);

// Get the format of a specific form
router.get('/jobforms/:formId', formController.getFormFormat);

// Get all responses of a form
router.get('/jobforms/:formId/responses', formController.getFormResponses);

// Submit a job application (public — resume + per-question file uploads)
router.post('/jobforms/:formId/responses', upload.any(), formController.submitFormResponse);

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
