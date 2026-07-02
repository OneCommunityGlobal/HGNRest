const express = require('express');

const router = express.Router();
const controller = require('../../controllers/bmdashboard/bmToolAvailabilityController');

router.get('/tools/availability', controller.getToolAvailability);

module.exports = router;
