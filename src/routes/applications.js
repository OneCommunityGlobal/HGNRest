// HGNRest/src/routes/applications.routes.js
const router = require('express').Router();
const ctrl = require('../controllers/applicationsController');

router.get('/roles', ctrl.getRoles);
router.get('/applications', ctrl.getApplications);
router.get('/comparison', ctrl.getComparison);

module.exports = router;
