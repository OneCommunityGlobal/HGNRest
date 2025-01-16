const express = require('express');
const { body } = require('express-validator');

const route = function () {
    const controller = require('../controllers/registrationController')();

    const registrationRouter = express.Router();

    registrationRouter
    .route('/register/create')
    .post(
      body('eventId')
        .notEmpty()
        .withMessage('Event ID is required')
        .isMongoId()
        .withMessage('Invalid event ID format'),
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
      controller.cancelRegistration
    );

    return registrationRouter;
};

module.exports = route;