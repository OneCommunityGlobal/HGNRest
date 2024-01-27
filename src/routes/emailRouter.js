const express = require('express');
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

  emailRouter.route('/send-emails')
    .post(sendEmail);
  emailRouter.route('/broadcast-emails')
    .post(sendEmailToAll);

  emailRouter.route('/update-email-subscriptions')
    .post(updateEmailSubscriptions);
  emailRouter.route('/add-non-hgn-email-subscription')
    .post(addNonHgnEmailSubscription);
  emailRouter.route('/confirm-non-hgn-email-subscription')
    .post(confirmNonHgnEmailSubscription);
  emailRouter.route('/remove-non-hgn-email-subscription')
    .post(removeNonHgnEmailSubscription);
  return emailRouter;
};

module.exports = routes;