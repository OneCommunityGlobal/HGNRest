const express = require('express');
console.log("Email router loaded");
// adding a quick endpoint which i can call locally
const userHelper = require('../helpers/userHelper')();
const {
  sendEmail,
  sendEmailToAll,
  updateEmailSubscriptions,
  addNonHgnEmailSubscription,
  removeNonHgnEmailSubscription,
  confirmNonHgnEmailSubscription,
} = require('../controllers/emailController');

const routes = function () {
  const emailRouter = express.Router();

  emailRouter.route('/send-emails').post(sendEmail);
  emailRouter.route('/broadcast-emails').post(sendEmailToAll);

  emailRouter.route('/update-email-subscriptions').post(updateEmailSubscriptions);
  emailRouter.route('/add-non-hgn-email-subscription').post(addNonHgnEmailSubscription);
  emailRouter.route('/confirm-non-hgn-email-subscription').post(confirmNonHgnEmailSubscription);
  emailRouter.route('/remove-non-hgn-email-subscription').post(removeNonHgnEmailSubscription);

  // new route to test weekly summaries of active users,
  emailRouter.route('/email/weekly-summaries/test').post(async (req, res) => {
  try {
    const { testerEmail, weekIndex = 1, dryRun = false } = req.body || {};
    if (!testerEmail) return res.status(400).send('testerEmail is required');

    console.log('Running weekly summaries test with:', { testerEmail, weekIndex, dryRun });

    const result = await userHelper.emailWeeklySummariesForAllUsersTest({ testerEmail: 'taariqktm@gmail.com', weekIndex, dryRun });

    console.log('Result:', result);

    res.status(200).json({ ok: true, ...result });
  } catch (e) {//
    console.error('Weekly summaries test failed:', e);
    res.status(500).json({
      ok: false,
      errorMessage: e?.message || 'Unknown error',
      stack: e?.stack
    });
  }
  });

  return emailRouter;
};

module.exports = routes;
