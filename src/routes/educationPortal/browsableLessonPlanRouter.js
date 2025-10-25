const express = require('express');

module.exports = function (BrowsableLessonPlanModel, UserProfileModel) {
  const router = express.Router();
  const controller = require('../../controllers/educationPortal/browsableLessonPlansController')(
    BrowsableLessonPlanModel,
    UserProfileModel,
  );

  // List all lesson plans with filters/pagination
  router.get('/lesson-plans', controller.getLessonPlans);

  // Student saved interests
  router.post('/student/saved-interests', controller.saveStudentInterest);
  router.get('/student/saved-interests', controller.getStudentSavedInterests);

  return router;
};