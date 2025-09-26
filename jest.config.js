module.exports = {
  roots: ['<rootDir>/src'],
  collectCoverageFrom: [
    'src/**/*.js',
    'src/controllers/**/*.js',
    'src/routes/**/*.js', 
    'src/utilities/**/*.js',
    'src/helpers/**/*.js',
    'src/models/**/*.js',
    'src/services/**/*.js',
    'src/middleware/**/*.js',
    // Exclude test files and mock data
    '!src/**/*.test.js',
    '!src/**/*.spec.js',
    '!src/**/*MockData.js',
    '!src/**/*MockData.jsx',
    '!src/test/**',
    '!src/__tests__/**'
  ],
    // Coverage thresholds - Start light and increase gradually
  coverageThreshold: {
    global: {
      branches: 12,
      functions: 100,
      lines: 34,
      statements: 34
    },
    
  },

  // Coverage reporters - shows in terminal and generates reports
  coverageReporters: [
    'text',           // Terminal output
    'text-summary',   // Brief summary
    'lcov',          // For CI/CD tools
    'html',          // HTML report in coverage/ folder
    'json'           // JSON report for parsing
  ],
  testTimeout: 60000, // 1 minute for CI environments
  coverageDirectory: 'coverage',
  testEnvironment: 'node',
  transformIgnorePatterns: ['^.+\\.js$'],
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.js'],
  // Simple CI settings
  maxWorkers: 1, // Run tests sequentially
  forceExit: true, // Force exit after tests complete
};
