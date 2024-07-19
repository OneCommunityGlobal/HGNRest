const config = require('./jest.config');

config.testMatch = ['**/*.test.js'];
config.setupFilesAfterEnv = ['dotenv/config'];
module.exports = config;
