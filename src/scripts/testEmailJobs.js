const mongoose = require('mongoose');
require('dotenv').config();
const userHelper = require('../helpers/userHelper')();
// startup/db exports a function that connects.
const connectDb = require('../startup/db');
const readline = require('readline');

// --- TEST CONFIGURATION ---
// REPLACE THESE VALUES WITH YOUR TEST DATA
const TARGET_USER_ID = '1234567890'; // Dashboard -> Dev User Profile -> User ID in URL
const TESTER_EMAIL = 'recipient@gmail.com'; // Recipient email
const TESTER_CC = 'cc@gmail.com'; // Mandatory: Enter your test CC email
const TESTER_BCC = 'bcc@gmail.com'; // Mandatory: Enter your test BCC email
// --------------------------

const askQuestion = (query) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    });
  });
};

const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const runTests = async () => {
  if (!TARGET_USER_ID || !TESTER_EMAIL || !TESTER_CC || !TESTER_BCC) {
    console.error(
      'Error: Please configure TARGET_USER_ID, TESTER_EMAIL, TESTER_CC, and TESTER_BCC.',
    );
    process.exit(1);
  }

  console.log('\nSelect the test function to run:');
  console.log('1. assignBlueSquareForTimeNotMet');
  console.log('2. weeklyAutoReplyEmailFunction');
  console.log('3. Run Both');

  const choice = await askQuestion('\nEnter choice (1, 2, or 3): ');

  if (!['1', '2', '3'].includes(choice)) {
    console.log('Invalid selection. Exiting.');
    process.exit(0);
  }

  console.log('Connecting to DB...');
  if (mongoose.connection.readyState === 0) {
    await connectDb();
    await new Promise((resolve) => {
      mongoose.connection.once('open', resolve);
    });
    console.log('Connected to DB.');
  }

  const emailConfig = {
    targetUserId: new mongoose.Types.ObjectId(TARGET_USER_ID),
    emailOverride: TESTER_EMAIL,
    ccOverride: [TESTER_CC], // Helper expects array
    bccOverride: [TESTER_BCC], // Helper expects array
  };

  console.log(`\n--- Starting Tests for User: ${TARGET_USER_ID} ---\n`);

  try {
    if (choice === '1' || choice === '3') {
      console.log('Testing assignBlueSquareForTimeNotMet...');
      await userHelper.assignBlueSquareForTimeNotMet(emailConfig);
      console.log('   -> Done.\n');
    }

    if (choice === '2' || choice === '3') {
      console.log('Testing weeklyAutoReplyEmailFunction...');
      await userHelper.weeklyAutoReplyEmailFunction(emailConfig);
      console.log('   -> Done.\n');
    }

    // Small delay to allow queued background operations (EmailHistory/EmailThread) to finish
    await sleep(5000);
    console.log('Execution completed successfully.');
  } catch (error) {
    console.error('Error running tests:', error);
  } finally {
    console.log('Closing DB connection...');
    await mongoose.connection.close();
    process.exit(0);
  }
};

runTests();
