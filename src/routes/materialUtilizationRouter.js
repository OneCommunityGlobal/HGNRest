const express = require('express');
const controller = require('../controllers/materialUtilizationController');
// const authMiddleware = require('../middleware/auth'); // Optional: Add auth middleware if needed

const router = express.Router();

// GET /api/materials/utilization?start=...&end=...&projects[]=...
router.get(
  '/materials/utilization',
  // authMiddleware, // Uncomment if this route requires authentication
  controller.getMaterialUtilization,
);

router.get('/materials/distinct-projects', controller.getDistinctProjects);

router.get('/materials/distinct-materials', controller.getDistinctMaterials);

module.exports = router;
