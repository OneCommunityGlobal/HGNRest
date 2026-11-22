const express = require('express');
const {
  getCategoryBreakdown,
  getUniqueSeverities,
  getUniqueInjuryTypes,
  getProjectsWithInjuries,
  getInjuryTrendData,
} = require('../../controllers/bmdashboard/injuryCategoryController');
const { getInjuryOverTime } = require('../../controllers/bmdashboard/injuryOverTimeController');

const router = express.Router();

router.get('/category-breakdown', getCategoryBreakdown);
router.get('/injury-severities', getUniqueSeverities);
router.get('/injury-types', getUniqueInjuryTypes);
router.get('/project-injury', getProjectsWithInjuries);
router.get('/trend-data', getInjuryTrendData);
router.get('/over-time', getInjuryOverTime);

module.exports = router;
