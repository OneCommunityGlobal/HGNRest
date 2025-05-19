const express = require('express');
const router = express.Router();
const { getCategoryBreakdown } = require('../../controllers/bmdashboard/injuryCategoryController');

router.get('/category-breakdown', getCategoryBreakdown);

module.exports = router;
