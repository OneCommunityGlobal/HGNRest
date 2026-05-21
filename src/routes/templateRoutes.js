/**
 * Template Routes - API endpoints for template management
 */

const express = require('express');

const router = express.Router();
const templateController = require('../controllers/templateController');

// Template statistics (must come before /:id routes)
router.get('/stats', templateController.getTemplateStats);

// Template CRUD operations
router.get('/', templateController.getAllTemplates);
router.get('/:id', templateController.getTemplateById);
router.post('/', templateController.createTemplate);
router.put('/:id', templateController.updateTemplate);
router.delete('/:id', templateController.deleteTemplate);

// Template rendering and sending
router.post('/:id/render', templateController.renderTemplate);
router.post('/:id/send', templateController.sendTemplateEmail);

module.exports = router;
