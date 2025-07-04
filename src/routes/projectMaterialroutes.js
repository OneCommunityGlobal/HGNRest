const express = require("express");

const controller = require('../controllers/materialSusceptibleController');

const router = express.Router();

router.post('/projectMaterial', controller.createProjectMaterial);

router.get('/projectMaterial', controller.getProjectMaterial);

router.get('/projectMaterial/byDate', controller.getProjectMaterialByDate);

router.get('/projectMaterial/byProjectName', controller.getProjectMaterialByProject);

module.exports = router;