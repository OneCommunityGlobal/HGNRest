const express = require('express');

const router = express.Router();
const controller = require('../../controllers/bmdashboard/bmPaidLaborCostController')();

router.post('/', controller.getLaborCost);

module.exports = router;
