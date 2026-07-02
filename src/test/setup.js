// Global setup for Jest tests
// This file handles MongoDB connection setup and teardown

const mongoose = require('mongoose');

// Increase global timeout for MongoDB operations
jest.setTimeout(60000); // 1 minute

beforeAll(async () => {
  console.log('=== Global Jest Setup Started ===');
  console.log('Global setup completed');
});

afterAll(async () => {
  console.log('=== Global Jest Cleanup Started ===');
  await mongoose.disconnect();
  console.log('Global cleanup completed');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', error => {
  console.error('Uncaught Exception:', error);
});
