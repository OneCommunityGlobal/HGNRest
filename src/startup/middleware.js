const jwt = require('jsonwebtoken');

module.exports = function (app) {
  app.all('*', (req, res, next) => {
    if ((req.originalUrl === '/api/login' || req.originalUrl === '/api/forgotpassword') && req.method === 'POST') {
      next();
      return;
    }

    if (req.originalUrl === '/api/refreshToken' && req.method === 'POST') {
      next();
      return;
    }

    if (req.originalUrl === '/api/forcepassword' && req.method === 'PATCH') {
      next();
      return;
    }

    if (!req.header('Authorization')) {
      res.status(401).send({ 'error:': 'Unauthorized request: "Authorization" HTTP header not provided.' });
      return;
    }

    let payload;

    try {
      const authorizationHeader = req.header('Authorization').split(' ');
      const bearerPrefix = authorizationHeader[0];
      if (bearerPrefix !== 'Bearer') {
        res.status(401).send('Malformed JWT');
        return;
      }
      const base64Token = authorizationHeader[1];
      payload = jwt.verify(base64Token, process.env.JWT_SECRET);
    } catch (err) {
      console.log(err);
      res.status(401).send('Invalid token');
      return;
    }

    if (!payload?.userid || !payload?.role || !payload.exp) {
      res.status(401).send('Invalid JWT provided: One or more of the "exp", "userid", or "role" fields are missing.');
      return;
    }

    req.body.requestor = {
      requestorId: payload.userid,
      role: payload.role,
    };

    next();
  });
};
