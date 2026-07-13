const express = require('express');

const routes = function () {
  const controller = require('../controllers/announcementController')();
  const announcementRouter = express.Router();

  // POST /educator/announcements - Create a new announcement (Educator/Admin/Owner only)
  announcementRouter.route('/educator/announcements').post(controller.createAnnouncement);

  // GET /student/announcements - Get announcements for students
  announcementRouter.route('/student/announcements').get(controller.getStudentAnnouncements);

  // GET /educator/announcements - Get announcements created by the current educator
  announcementRouter.route('/educator/announcements').get(controller.getEducatorAnnouncements);

  return announcementRouter;
};

module.exports = routes;
