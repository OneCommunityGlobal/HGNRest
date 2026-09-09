const express = require('express');
const {
  createPin,
  schedulePin,
  fetchScheduledPin,
  deletedScheduledPin,
} = require('../controllers/socialMediaControllers');
const {
  initiatePinterestAuth,
  handlePinterestCallback,
} = require('../controllers/socialMediaControllers');

const socialMediaRouter = express.Router();

// social media routes
socialMediaRouter.route('/pinterest/createPin').post(createPin);
// Step 1 — redirects user to Pinterest login
socialMediaRouter.route('/pinterest/auth').get(initiatePinterestAuth);

// Step 2 — Pinterest redirects back here with ?code=
socialMediaRouter.route('/pinterest/auth/callback').get(handlePinterestCallback);
socialMediaRouter.route('/pinterest/schedule').post(schedulePin);
socialMediaRouter.route('/pinterest/schedule').get(fetchScheduledPin);
socialMediaRouter.route('/pinterest/schedule/:id').delete(deletedScheduledPin);

module.exports = socialMediaRouter;
