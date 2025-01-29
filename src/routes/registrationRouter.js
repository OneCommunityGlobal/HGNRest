const express = require('express');
const { body, validationResult } = require('express-validator');

const route = function () {
    const controller = require('../controllers/registrationController')();

    const registrationRouter = express.Router();

    const validate = (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
          return res.status(400).json({ error: errors.array()[0].msg });
      }
      next();
  };

    registrationRouter
    .route('/register/create')
    .post(
      body('eventId')
        .notEmpty()
        .withMessage('Event ID is required')
        .isMongoId()
        .withMessage('Invalid event ID format'),
      validate,
      controller.createRegistration
    );

    registrationRouter
    .route('/register/cancel')
    .post(
      body('registrationId')
        .notEmpty()
        .withMessage('Registration ID is required')
        .isMongoId()
        .withMessage('Invalid registration ID format'),
      validate,
      controller.cancelRegistration
    );

    return registrationRouter;
};

module.exports = route;