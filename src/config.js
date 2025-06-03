require('dotenv').config();

const config = {};
config.JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_here';
config.REQUEST_AUTHKEY = 'Authorization';
config.TOKEN = {
  Lifetime: process.env.TOKEN_LIFETIME || 10,
  Units: process.env.TOKEN_LIFETIME_UNITS || 'days',
};
config.JWT_HEADER = {
  alg: 'HS256',
  typ: 'JWT',
};

if (!config.JWT_SECRET) {
  console.warn('Warning: JWT_SECRET is not set in environment variables');
}

module.exports = config;
