const express = require('express');

const router = express.Router();

const {
  getCategoryBreakdown,
  getUniqueSeverities,
  getUniqueInjuryTypes,
  getProjectsWithInjuries,
  getInjuryTrendData,
  createInjuries,
} = require('../../controllers/bmdashboard/injuryCategoryController');

router.get('/category-breakdown', getCategoryBreakdown);
router.get('/injury-severities', getUniqueSeverities);
router.get('/injury-types', getUniqueInjuryTypes);
router.get('/project-injury', getProjectsWithInjuries);
router.get('/trend-data', getInjuryTrendData);
// Base path is '/api/bm/injuries' from startup/routes, so POST to '/api/bm/injuries'
router.post('/', createInjuries);

module.exports = router;
