const express = require('express');

const router = express.Router();
const intermediateTaskController = require('../controllers/intermediateTaskController');

// Initialize controller
const controller = intermediateTaskController();

// Routes
router.post('/intermediate-tasks', controller.createIntermediateTask);
router.get('/intermediate-tasks/:id', controller.getIntermediateTaskById);
router.get('/tasks/:taskId/intermediate', controller.getIntermediateTasksByParent);
router.put('/intermediate-tasks/:id', controller.updateIntermediateTask);
router.delete('/intermediate-tasks/:id', controller.deleteIntermediateTask);

module.exports = router;
