const express = require('express');
const questionSetController = require('../controllers/questionSetController');

const router = express.Router();

// Get all question sets with optional filtering
router.get('/', questionSetController.getAllQuestionSets);

// Get question sets by category
router.get('/category/:category', questionSetController.getQuestionSetsByCategory);

// Get a specific question set by ID
router.get('/:id', questionSetController.getQuestionSetById);

// Create a new question set
router.post('/', questionSetController.createQuestionSet);

// Update an existing question set
router.put('/:id', questionSetController.updateQuestionSet);

// Delete a question set
router.delete('/:id', questionSetController.deleteQuestionSet);

// Clone a question set
router.post('/:id/clone', questionSetController.cloneQuestionSet);

module.exports = router;
