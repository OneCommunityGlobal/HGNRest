const router = require('express').Router();
const ctrl = require('../controllers/applicationsController');

// Base path is /applications to match your screenshots

// GET http://localhost:4500/applications/roles
router.get('/roles', ctrl.getRoles);

// GET http://localhost:4500/applications?filter=weekly|monthly|yearly[&roles=a,b]
//    or http://localhost:4500/applications?startDate=...&endDate=...
router.get('/', ctrl.getApplications);

// GET http://localhost:4500/applications/comparison?filter=weekly|monthly|yearly[&roles=a,b]
router.get('/comparison', ctrl.getComparison);

module.exports = router;
