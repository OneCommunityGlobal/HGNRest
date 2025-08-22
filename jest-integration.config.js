// const config = require('./jest.config');

// config.testMatch = ['**/*.test.js'];
// module.exports = config;

const path = require('path');
const baseConfig = require('./jest.config');

module.exports = {
  ...baseConfig,
  testMatch: ['**/test/integration/**/*.test.js'],
  testEnvironment: 'node',
  transform: {
    '^.+\\.js$': [
      'babel-jest',
      {
        configFile: path.resolve(__dirname, 'babel.config.js'),
      },
    ],
  },
};
