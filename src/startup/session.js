const session = require('express-session');
const config = require('../config');

module.exports = function configureSession(app) {
  app.set('trust proxy', 1); // trust first proxy if you're behind one

  app.use(
    session({
      secret: config.JWT_SECRET || 'your-secret-key',
      resave: true, // Changed to true to ensure session is saved
      saveUninitialized: true, // Changed to true to create session for all requests
      cookie: {
        secure: process.env.NODE_ENV === 'production', // Set to false for development
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        path: '/',
      },
      name: 'hgn.sid', // Custom session cookie name
    }),
  );
};
