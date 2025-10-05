const express = require('express');
const {
  createPin,
  schedulePin,
  fetchScheduledPin,
  deletedScheduledPin,
} = require('../controllers/socialMediaController');

const socialMediaRouter = express.Router();

// social media routes
console.log('Social Media Router is being loaded');

socialMediaRouter.route('/pinterest/createPin').post(createPin);
socialMediaRouter.route('/pinterest/schedule').post(schedulePin);
socialMediaRouter.route('/pinterest/schedule').get(fetchScheduledPin);
socialMediaRouter.route('/pinterest/schedule/:id').delete(deletedScheduledPin);

module.exports = socialMediaRouter;
