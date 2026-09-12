const express = require('express');
const laborCostController = require('../controllers/laborCostController');

const laborCostRouter = express.Router();

laborCostRouter.post('/labourCost', laborCostController.createLabourCost);

laborCostRouter.get('/labourCost', laborCostController.getLabourCost);

laborCostRouter.get('/labourCost/byDate', laborCostController.getLabourCostByDate);

laborCostRouter.get('/labourCost/byProjectName', laborCostController.getLabourCostByProject);

laborCostRouter.get('/labourCost/byTaskName', laborCostController.getLabourCostByTask);

module.exports = laborCostRouter;
