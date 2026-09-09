const express = require('express');

const router = express.Router();

const { getServerTime } = require('../controllers/serverTimeController');

router.get('/servertime', getServerTime);

module.exports = router;
