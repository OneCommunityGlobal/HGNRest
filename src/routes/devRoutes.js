const express = require('express');

const router = express.Router();

const signupDevAccount = require('../controllers/devController');

router.post('/signup-production', signupDevAccount);

module.exports = router;
