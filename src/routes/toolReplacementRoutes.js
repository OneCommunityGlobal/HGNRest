const express = require('express');

const toolReplacementController = require('../controllers/toolReplacementController')();

const router = express.Router();

router.route('/tools/availability').get(toolReplacementController.getToolReplacement);

module.exports = router;
