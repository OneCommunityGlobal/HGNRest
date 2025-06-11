const cors = require('cors');

module.exports = function (app) {
   app.use(cors({
      origin: ['http://localhost:3000', 'http://localhost:3001'],
      credentials: true, // Important: required for cookies
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
   }));
};
