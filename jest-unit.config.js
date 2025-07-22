const baseConfig = require('./jest.config');

module.exports = {
  ...baseConfig,
  testMatch: ['**/test/unit/**/*.test.js'], // or '**/*.spec.js' if needed
  testEnvironment: 'node'
};

