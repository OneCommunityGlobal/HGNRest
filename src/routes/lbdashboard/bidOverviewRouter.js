const express = require('express');
const bidOverviewController = require('../../controllers/lbdashboard/bidOverviewController');

const router = express.Router();

// Get bid overview for a listing
router.get('/:id', bidOverviewController.getBidOverview);

// Place a new bid
router.post('/placeBid/:id', bidOverviewController.placeBid);

module.exports = router;
