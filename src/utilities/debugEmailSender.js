// Debug script to validate email sender module can be loaded
// This is used in CI to ensure emailSender.js is properly configured

try {
  // Attempt to require the emailSender module
  const emailSender = require('./emailSender');

  // Validate that emailSender is a function
  if (typeof emailSender !== 'function') {
    throw new Error('emailSender is not a function');
  }

  console.log('✓ Email sender module loaded successfully');
  process.exit(0);
} catch (error) {
  console.error('✗ Error loading email sender module:', error.message);
  process.exit(1);
}
