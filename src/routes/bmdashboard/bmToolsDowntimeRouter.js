const express = require('express');

const router = express.Router();
const controller = require('../../controllers/bmdashboard/bmToolsDowntimeController')();

// POST /api/tools/utilization - Create new tools downtime record
router.post('/tools/utilization', controller.createToolsDowntime);

// GET /api/tools/utilization - Get all tools downtime records
router.get('/tools/utilization', controller.fetchAllToolsDowntime);

// GET /api/tools/utilization/:id - Get single tools downtime record
router.get('/tools/utilization/:id', controller.fetchSingleToolsDowntime);

// PUT /api/tools/utilization/:id - Update tools downtime record
router.put('/tools/utilization/:id', controller.updateToolsDowntime);

// DELETE /api/tools/utilization/:id - Delete tools downtime record
router.delete('/tools/utilization/:id', controller.deleteToolsDowntime);

// GET /api/tools/utilization/project/:projectId - Get tools downtime by project
router.get('/tools/utilization/project/:projectId', controller.getToolsDowntimeByProject);

// GET /api/tools/utilization/tool/:toolId - Get tools downtime by tool
router.get('/tools/utilization/tool/:toolId', controller.getToolsDowntimeByTool);

// GET /api/tools/utilization/stats - Get tools downtime statistics
router.get('/tools/utilization/stats', controller.getToolsDowntimeStats);

module.exports = router;
