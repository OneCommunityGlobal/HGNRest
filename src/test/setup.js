// Global setup for Jest tests
// This file handles MongoDB connection setup and teardown

const mongoose = require('mongoose');

// Increase global timeout for MongoDB operations
jest.setTimeout(60000);

// Global beforeAll hook
beforeAll(async () => {
  // MongoDB will use default buffering behavior
});

// Global afterAll hook
afterAll(async () => {
  // Ensure all connections are closed
  await mongoose.disconnect();
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});
