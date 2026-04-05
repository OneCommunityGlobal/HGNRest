const express = require('express');

const router = express.Router();
const educatorController = require('../controllers/educatorController');

// Initialize controller
const controller = educatorController();

// Routes
router.post('/assign-atoms', controller.assignAtoms);

module.exports = router;
