const cors = require('cors');

module.exports = function (app) {
  const allowedOrigins = new Set([
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:4173',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:4173',
    'http://127.0.0.1:5173',
    'https://dev.highestgood.com',
    'https://highestgood.com',
    'https://www.highestgood.com/dashboard',
  ]);

  app.use(
    cors({
      origin(origin, callback) {
        // Allow non-browser requests (no Origin header) like curl/postman/server-to-server.
        if (!origin) return callback(null, true);
        if (allowedOrigins.has(origin)) return callback(null, true);
        return callback(new Error(`CORS not allowed for origin: ${origin}`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );
};
