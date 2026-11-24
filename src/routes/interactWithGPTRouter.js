const express = require('express');
const controller = require('../controllers/interactWithGPTController');

const router = express.Router();

router.post('/interactWithGPT', controller.interactWithGPT);

module.exports = router;
