const Redis = require('ioredis');

const redis = new Redis({
  host: 'localhost',
  port: 6379,
  // password: process.env.REDIS_PASSWORD, // if applicable
});

module.exports = redis;