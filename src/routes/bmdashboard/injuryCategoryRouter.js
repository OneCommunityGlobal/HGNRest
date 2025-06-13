const express = require('express');
const router = express.Router();
const { getCategoryBreakdown, getUniqueSeverities, getUniqueInjuryTypes } = require('../../controllers/bmdashboard/injuryCategoryController');

router.get('/category-breakdown', getCategoryBreakdown);
router.get('/injury-severities', getUniqueSeverities);
router.get('/injury-types', getUniqueInjuryTypes);

module.exports = router;
