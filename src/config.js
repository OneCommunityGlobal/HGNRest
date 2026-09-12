require('dotenv').config();

const config = {};
config.JWT_SECRET = process.env.JWT_SECRET || 'development-secret';
config.REQUEST_AUTHKEY = 'Authorization';
config.TOKEN = {
  Lifetime: process.env.TOKEN_LIFETIME || 10,
  Units: process.env.TOKEN_LIFETIME_UNITS || 'days',
};
config.JWT_HEADER = {
  alg: 'RS256',
  typ: 'JWT',
};

module.exports = config;
