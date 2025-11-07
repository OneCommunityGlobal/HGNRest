const express = require('express');
const { getKnowledgeEvolution } = require('../../controllers/knowledgeEvolutionController');

const router = express.Router();

router.get('/student/knowledge-evolution', getKnowledgeEvolution);

module.exports = router;
