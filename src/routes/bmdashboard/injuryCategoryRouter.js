const express = require('express');

const router = express.Router();

const {
  getCategoryBreakdown,
  getUniqueSeverities,
  getUniqueInjuryTypes,
  getProjectsWithInjuries,
} = require('../../controllers/bmdashboard/injuryCategoryController');

const { getInjuryOverTime } = require('../../controllers/bmdashboard/injuryOverTimeController');

router.get('/category-breakdown', getCategoryBreakdown);
router.get('/injury-severities', getUniqueSeverities);
router.get('/injury-types', getUniqueInjuryTypes);
router.get('/project-injury', getProjectsWithInjuries);

router.get('/over-time', getInjuryOverTime);

module.exports = router;
