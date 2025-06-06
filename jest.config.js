module.exports = {
  roots: ['<rootDir>/src'],
  collectCoverageFrom: [
    '!<rootDir>/src/**/*.js', // need to collect coverage from all files that are involved in serving an API request
    '!<rootDir>/src/server.js',
    '!<rootDir>/src/models/**/*.js',
    '!<rootDir>/src/startup/**/*.js',
    '!<rootDir>/src/test/**/*.js',
    '!<rootDir>/src/utilities/**/*.js', // need to collect coverage from utilities after all unit tests have been created
  ],
  testTimeout: 15000,
  coverageDirectory: 'coverage',
  testEnvironment: 'node',
  transformIgnorePatterns: ['^.+\\.js$'],
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
};
