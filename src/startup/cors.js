const cors = require('cors');

module.exports = function (app) {
  app.use(cors({
    origin: ['https://ed07-52-119-103-1.ngrok-free.app', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
  }));
};