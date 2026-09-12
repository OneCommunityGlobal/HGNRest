const express = require('express');
const applicationTimeController =
  require('../../controllers/jobAnalytics/applicationTimeController')();

const router = express.Router();

router.route('/application-time').get(applicationTimeController.getApplicationTimes);
router.route('/application-time/roles').get(applicationTimeController.getUniqueRoles);

module.exports = router;
