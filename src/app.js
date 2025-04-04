const express = require('express');
const Sentry = require('@sentry/node');
const compression = require('compression');

const app = express();
const logger = require('./startup/logger');
const globalErrorHandler = require('./utilities/errorHandling/globalErrorHandler');

logger.init();

// Sentry request handler (must be first)
app.use(Sentry.Handlers.requestHandler());

// ✅ Gzip compression middleware
app.use(
  compression({
    level: 6,
    threshold: 0,
    filter: (req, res) => {
      const contentType = res.getHeader('Content-Type') || '';
      return /json|text|javascript|css|html/.test(contentType);
    }
  })
);

// ✅ Built-in body parsers
require('./startup/bodyParser')(app);

// ✅ CORS middleware (can be added directly or kept in startup)
require('./startup/cors')(app);

// ✅ Custom middleware, if any
require('./startup/middleware')(app);
require('./startup/routes')(app);

// ✅ Example route directly added (assuming ./routes/userprofile.js exists)


// ⬅️ Add more routes as needed here
// app.use('/api/tasks', require('./routes/tasks'));
// app.use('/api/login', require('./routes/login'));

// Sentry error handler
app.use(Sentry.Handlers.errorHandler());

// Global error handling
app.use(globalErrorHandler);

module.exports = { app, logger };
