const express = require('express');
const {
  getKnowledgeEvolution,
} = require('../../controllers/bmdashboard/knowledgeEvolutionController');

const router = express.Router();

router.get('/student/knowledge-evolution', getKnowledgeEvolution);

module.exports = router;
