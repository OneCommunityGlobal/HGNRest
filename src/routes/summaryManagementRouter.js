const express = require('express');

const router = function (summaryGroup) {
  const controller = require('../controllers/summaryManagementController')(summaryGroup);

  const summaryManagementRouter = express.Router();

  summaryManagementRouter.route('/SUMMARY_GROUPS')

    .post(controller.postNewSummaryGroup)
    .get(controller.getAllSummaryGroup);

  summaryManagementRouter.route('/SUMMARY_GROUPS/:summaryGroupId')
    .delete(controller.deleteSummaryGroup)
    .put(controller.putSummaryGroup);

  return summaryManagementRouter;
};

module.exports = router;
