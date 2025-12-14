const express = require('express');

module.exports = function (BrowsableLessonPlanModel, UserProfileModel) {
  const router = express.Router();
  const controller = require('../../controllers/educationPortal/browsableLessonPlansController')(
    BrowsableLessonPlanModel,
    UserProfileModel,
  );

  router.get('/lesson-plans', controller.getLessonPlans);
  router.get('/lesson-plans/:id', controller.getLessonPlanById);

  router.post('/student/saved-interests', controller.saveStudentInterest);
  router.get('/student/saved-interests', controller.getStudentSavedInterests);
  router.delete('/student/saved-interests/:lessonPlanId', controller.removeStudentInterest);
  router.get('/student/saved-interests/check', controller.checkIfSaved);

  return router;
};