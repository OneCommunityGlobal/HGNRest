const express = require('express');

const router = express.Router();
const injuryController = require('../controllers/injuryController');

// Get all injuries with optional filters
router.get('/injuries', injuryController.getInjuries);

// Get all projects for dropdown
router.get('/projects', injuryController.getProjects);

// Create new injury record
router.post('/injuries', injuryController.createInjury);

// Update injury record
router.put('/injuries/:id', injuryController.updateInjury);

// Delete injury record
router.delete('/injuries/:id', injuryController.deleteInjury);

module.exports = router;