const express = require('express');

const villageRouter = express.Router();
const villagesController = require('../../controllers/lb_dashboard/villages');

const controller = villagesController();

// Get all villages
villageRouter.get('/', controller.getAllVillages);

// Get village by region ID
villageRouter.get('/region/:regionId', controller.getVillageByRegion);

// Create a new village
villageRouter.post('/', controller.validateVillage, controller.createVillage);

// Get a single village by ID
villageRouter.get('/:id', controller.getVillageById);

// Update a village
villageRouter.put('/:id', controller.validateVillage, controller.updateVillage);

// Delete a village
villageRouter.delete('/:id', controller.deleteVillage);

module.exports = villageRouter;