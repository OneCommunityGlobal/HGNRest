const Sentry = require('@sentry/node');

exports.init = function () {
  Sentry.init({ dsn: process.env.SentryDSN_URL });
};

exports.logInfo = function (message) {
  Sentry.captureMessage(message);
  if (process.env.NODE_ENV === 'development') {
    console.log(message);
  }
};

exports.logException = function (error) {
  Sentry.captureException(error);
};
