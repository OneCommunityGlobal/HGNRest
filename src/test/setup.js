// Global setup for Jest tests
// This file handles MongoDB connection setup and teardown

const mongoose = require('mongoose');

// Increase global timeout for MongoDB operations
jest.setTimeout(120000); // 2 minutes

// Global beforeAll hook
beforeAll(async () => {
  console.log('=== Global Jest Setup Started ===');
  // MongoDB will use default buffering behavior
  console.log('✓ Global setup completed');
});

// Global afterAll hook
afterAll(async () => {
  console.log('=== Global Jest Cleanup Started ===');
  // Ensure all connections are closed
  await mongoose.disconnect();
  console.log('✓ Global cleanup completed');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// Handle process termination
process.on('SIGTERM', () => {
  console.log('SIGTERM received, cleaning up...');
  mongoose.disconnect().then(() => {
    console.log('MongoDB disconnected on SIGTERM');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, cleaning up...');
  mongoose.disconnect().then(() => {
    console.log('MongoDB disconnected on SIGINT');
    process.exit(0);
  });
});
