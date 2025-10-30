const express = require('express');
const emailTemplateController = require('../controllers/emailTemplateController');

const router = express.Router();

// Email template routes
router.get('/email-templates', emailTemplateController.getAllEmailTemplates);
router.get('/email-templates/:id', emailTemplateController.getEmailTemplateById);
router.post('/email-templates', emailTemplateController.createEmailTemplate);
router.put('/email-templates/:id', emailTemplateController.updateEmailTemplate);
router.delete('/email-templates/:id', emailTemplateController.deleteEmailTemplate);

module.exports = router;
