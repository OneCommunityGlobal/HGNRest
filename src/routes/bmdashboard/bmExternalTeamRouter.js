const express = require('express');

const router = express.Router();
const { createExternalTeam } = require('../../controllers/bmdashboard/bmExternalTeamController');

router.post('/externalTeam', createExternalTeam);

module.exports = router;
