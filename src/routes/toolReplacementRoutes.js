const express = require('express');
const toolReplacementController = require('../controllers/toolReplacementController')();

const router = express.Router();

// Distinct from existing BM /tools/availability endpoint
router.route('/tools/replacements').get(toolReplacementController.getToolReplacement);

module.exports = router;
