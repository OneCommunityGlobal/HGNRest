const express = require('express');

const controller = require('../controllers/educationUserProfileController');

const studentProfileRouter = express.Router();

studentProfileRouter
  .route('/')
  .get(controller.getStudentProfile)
  .put(controller.updateStudentProfile);

studentProfileRouter.route('/subject/:id').get(controller.getSubjectTasks);

module.exports = studentProfileRouter;
