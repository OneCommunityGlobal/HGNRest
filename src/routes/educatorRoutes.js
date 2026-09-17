const express = require('express');

const router = express.Router();

const { getTaskSubmissions } = require('../controllers/educationTaskController')();

router.get('/task-submissions', getTaskSubmissions);

module.exports = router;
