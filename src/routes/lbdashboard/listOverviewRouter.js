const express = require('express');

const routes = () => {
  const listOverviewRouter = express.Router();
  const controller = require('../../controllers/lbdashboard/listOverviewController');
  listOverviewRouter.route('/listOverview/:id').get(controller.getListOverview);
  listOverviewRouter.route('/submitBooking').post(controller.submitBooking);
  return listOverviewRouter;
};
module.exports = routes;
