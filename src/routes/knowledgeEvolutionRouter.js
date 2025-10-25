const express = require('express');

const router = express.Router();
const controller = require('../controllers/knowledgeEvolutionController');

router.get('/', controller.getKnowledgeEvolution);

module.exports = router;
