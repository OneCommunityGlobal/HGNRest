require('dotenv').config();

const config = {};

config.JWT_SECRET = process.env.JWT_SECRET;
config.REQUEST_AUTHKEY = 'Authorization';
config.TOKEN = {
  Lifetime: process.env.TOKEN_LIFETIME,
  Units: process.env.TOKEN_LIFETIME_UNITS,
};
config.JWT_HEADER = {
  alg: 'RS256',
  typ: 'JWT',
};

config.GEMINI_API_KEY = 'AIzaSyBUPF-ZUgbSPyCxaopAN3ik86CeJ2jW0jU';
module.exports = config;
