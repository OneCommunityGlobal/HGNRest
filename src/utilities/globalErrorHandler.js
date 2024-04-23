/* eslint-disable no-console */
const { v4: uuidv4 } = require('uuid');
const { CustomError } = require('./customError');
const Logger = require('../startup/logger');

/**
 * Custom error handler middleware for global unhandled errors. Make it the last middleware since it returns a response and do not call next().
*/
function globalErrorHandler(err, req, res, next) {
  /**
   * Notes:
   * 1. We will need to implement a global distributed eventId for tracking errors
   *    if move to microservices artechtecture or with replicated services
   * 2. Developer will use the eventId (Searchable) to trace the error in the Sentry.io
   */
  const trackingId = uuidv4();
  const errorMessage = `An internal error has occurred. If the issue persists, please contact the administrator and provide the trakcing ID: ${trackingId}`;
  let transactionName = '';
  const requestData = req.body && req.method ? JSON.stringify(req.body) : null;

  if (req.method) {
    transactionName = transactionName.concat(req.method);
  }
  if (req.url) {
    transactionName = transactionName.concat(' ', req.originalUrl);
  }

  // transactionName = transactionName.concat(' ', 'Tracking ID: ', eventId);

  // Log the error to Sentry if not in local environment
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'production') {
    Logger.logException(
      err,
      transactionName,
      requestData,
      trackingId
    );
  } else {
    console.log(`An error occurred. Event ID: ${trackingId} \nRequest Data: ${requestData}`);
    console.error(err);
  }

  // If the error is an instance of CustomError, return the error message and status code
  if (err instanceof CustomError) {
    return res.status(err.statusCode).json({ error: err.message, errorMessage });
  }

  // else return generic error message with tracking id and status code 500
  return res.status(500).json({
    errorMessage,
  });
}

export default globalErrorHandler;
