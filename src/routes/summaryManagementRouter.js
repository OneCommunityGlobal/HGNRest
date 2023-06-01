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
  summaryManagementRouter.route('/SUMMARY_GROUPS/:summaryGroupId/teamMembers')
    .post(controller.addTeamMemberToSummaryGroup)
    .get(controller.getTeamMembersBySummaryGroupId);

  summaryManagementRouter.route('/SUMMARY_GROUPS/:summaryGroupId/teamMembers/:userId/')
    .delete(controller.deleteTeamMemberToSummaryGroup);
  summaryManagementRouter.route('/SUMMARY_GROUPS/:summaryGroupId/summaryReceivers')
    .post(controller.addSummaryReceiversToSummaryGroup)
    .get(controller.getSummaryReceiversBySummaryGroupId);
  summaryManagementRouter.route('/SUMMARY_GROUPS/:summaryGroupId/summaryReceivers/:userId')
    .delete(controller.deleteSummaryReceiverToSummaryGroup);

  return summaryManagementRouter;
};

module.exports = router;
