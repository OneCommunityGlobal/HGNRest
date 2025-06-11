const session = require('express-session');
const config = require('../config');

module.exports = function (app) {
   app.set('trust proxy', 1); // trust first proxy if you're behind one

   app.use(session({
      secret: config.JWT_SECRET || 'your-secret-key',
      resave: true, // Changed to true to ensure session is saved
      saveUninitialized: true, // Changed to true to create session for all requests
      cookie: {
         secure: process.env.NODE_ENV === 'production' ? true : false, // Set to false for development
         httpOnly: true,
         sameSite: 'lax',
         maxAge: 24 * 60 * 60 * 1000, // 24 hours
         path: '/',
      },
      name: 'hgn.sid', // Custom session cookie name
   }));

   // Debug middleware to log session data
   app.use((req, res, next) => {
      console.log('\n[Session Debug] ----------------');
      console.log('Request URL:', req.url);
      console.log('Session ID:', req.sessionID);
      console.log('Session Data:', JSON.stringify(req.session, null, 2));
      console.log('Cookies:', req.headers.cookie);
      console.log('[Session Debug] ----------------\n');
      next();
   });
};
