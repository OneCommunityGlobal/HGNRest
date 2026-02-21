const express = require('express');
const {
  sendEmail,
  sendEmailToSubscribers,
  resendEmail,
  updateEmailSubscriptions,
  addNonHgnEmailSubscription,
  removeNonHgnEmailSubscription,
  confirmNonHgnEmailSubscription,
  retryEmail,
  processPendingAndStuckEmails,
} = require('../controllers/emailController');

const routes = function () {
  const emailRouter = express.Router();

  emailRouter.route('/send-emails').post(sendEmail);
  emailRouter.route('/broadcast-emails').post(sendEmailToSubscribers);
  emailRouter.route('/resend-email').post(resendEmail);
  emailRouter.route('/retry-email/:emailId').post(retryEmail);
  emailRouter.route('/process-pending-and-stuck-emails').post(processPendingAndStuckEmails);

  emailRouter.route('/update-email-subscriptions').post(updateEmailSubscriptions);
  emailRouter.route('/add-non-hgn-email-subscription').post(addNonHgnEmailSubscription);
  emailRouter.route('/confirm-non-hgn-email-subscription').post(confirmNonHgnEmailSubscription);
  emailRouter.route('/remove-non-hgn-email-subscription').post(removeNonHgnEmailSubscription);
  return emailRouter;
};

module.exports = routes;
