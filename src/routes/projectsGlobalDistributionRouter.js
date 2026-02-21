const express = require('express');

const router = express.Router();
const projectGlobalDistributionController = require('../controllers/projectsGlobalDistributionController');

router.get('/projectglobaldistribution', projectGlobalDistributionController);

module.exports = router;
