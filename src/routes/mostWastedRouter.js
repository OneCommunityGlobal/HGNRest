const express = require('express');

const controller = require('../controllers/mostWastedController');

const router = express.Router();

router.post('/wastedMaterial', controller.createWastedMaterial);

router.get('/wastedMaterial', controller.getWastedMaterial);

router.get('/wastedMaterial/byDate', controller.getWastedMaterialByDate);

router.get('/wastedMaterial/byProjectId', controller.getWastedMaterialByProject);

module.exports = router;
