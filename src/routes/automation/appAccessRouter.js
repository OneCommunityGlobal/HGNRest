const express = require('express');

const appAccessController = require('../../controllers/automation/appAccessController');

const router = express.Router();

router.get('/', appAccessController.getAppAccess);

module.exports = router;