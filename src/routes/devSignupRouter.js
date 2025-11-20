const express = require('express');

const router = express.Router();
const { devSignup } = require('../controllers/devSignupController');
// POST /api/dev/signup-production
router.post('/signup-production', devSignup);

module.exports = router;
