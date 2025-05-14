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
  testTimeout: 30000,
  coverageDirectory: 'coverage',
  testEnvironment: 'node',
  transformIgnorePatterns: [
    'node_modules/(?!(@octokit|@octokit/rest|@octokit/core|@babel/runtime|@octokit/plugin-request-log)/)'
  ],
  transform: {
    '^.+\\.js$': ['babel-jest', { 
      configFile: './.babelrc',
      presets: [
        ['@babel/preset-env', {
          targets: {
            node: 'current'
          },
          modules: 'commonjs'
        }]
      ]
    }]
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: ['**/*.spec.js'],
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  moduleDirectories: ['node_modules', 'src']
};
