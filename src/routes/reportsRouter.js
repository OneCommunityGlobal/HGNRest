/* eslint-disable quotes */
const express = require('express');

const route = function () {
  const controller = require('../controllers/reportsController')();

  const reportsRouter = express.Router();

  reportsRouter
    .route('/reports/recepients/:userid')
    .patch(controller.saveReportsRecepients)
    .delete(controller.deleteReportsRecepients);

  reportsRouter.route('/reports/getrecepients').get(controller.getReportRecipients);

  reportsRouter.route('/reports/weeklysummaries').get(controller.getWeeklySummaries);
  reportsRouter.get('/reports/weeklysummaries/teamcodes', controller.getAllDistinctTeamCodes);

  reportsRouter
    .route('/reports/overviewsummaries/volunteerstats')
    .get(controller.getVolunteerStats);

  reportsRouter
    .route('/reports/overviewsummaries/volunteerhoursstats')
    .get(controller.getVolunteerHoursStats);

  reportsRouter
    .route('/reports/overviewsummaries/taskandprojectstats')
    .get(controller.getTaskAndProjectStats);

  reportsRouter
    .route('/reports/overviewsummaries/volunteerrolestats')
    .get(controller.getVolunteerRoleStats);

  reportsRouter.route('/reports/overviewsummaries/bluestats').get(controller.getBlueSquareStats);

  reportsRouter.route('/reports/volunteerstats').get(controller.getVolunteerStatsData);

  reportsRouter.route('/reports/volunteertrends').get(controller.getVolunteerTrends);

  reportsRouter.route('/reports/teams').get(controller.getTeamsWithActiveMembers);

  reportsRouter.route('/reports/getAdminList').get(controller.getAdminList);

  reportsRouter.route('/reports/sendEmailReport').post(controller.sendEmailReport);

  reportsRouter.route('/reports/teamcodes').get(controller.getReportTeamCodes);

  // TEMPORARY DEBUG ROUTE -- remove once infringement date investigation is done
  reportsRouter.get('/reports/debug/infringement-dates', async (req, res) => {
    try {
      const UserProfile = require('../models/userProfile');
      const results = await UserProfile.aggregate([
        { $unwind: '$infringements' },
        {
          $project: {
            _id: 0,
            date: '$infringements.date',
            description: '$infringements.description',
          },
        },
        { $sort: { date: -1 } },
        { $limit: 20 },
      ]);
      res.json(results);
    } catch (err) {
      res.status(500).json({ msg: 'Debug query failed', error: err.message });
    }
  });

  return reportsRouter;
};

module.exports = route;
