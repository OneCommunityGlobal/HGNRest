const mongoose = require('mongoose');
require('dotenv').config();
const userHelper = require('../helpers/userHelper')();
// startup/db exports a function that connects.
const connectDb = require('../startup/db');

// --- TEST CONFIGURATION ---
// REPLACE THESE VALUES WITH YOUR TEST DATA
const TARGET_USER_ID = '687f07e15d3d1f26fccccb5a';
const TESTER_EMAIL = 'sohail.u.sy@gmail.com';
const TESTER_CC = 'bfire9989@gmail.com'; // Mandatory: Enter your test CC email
const TESTER_BCC = 'syedsohail601@gmail.com'; // Mandatory: Enter your test BCC email
// --------------------------

const runTests = async () => {
  if (!TARGET_USER_ID || !TESTER_EMAIL) {
    console.error('Error: Please set TARGET_USER_ID and TESTER_EMAIL in the script.');
    process.exit(1);
  }

  if (!TESTER_CC || !TESTER_BCC) {
    console.error(
      'Error: SAFETY CHECK FAILED. You must provide TESTER_CC and TESTER_BCC addresses to avoid spamming production users.',
    );
    process.exit(1);
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
    targetUserId: mongoose.Types.ObjectId(TARGET_USER_ID),
    emailOverride: TESTER_EMAIL,
    ccOverride: [TESTER_CC], // Helper expects array
    bccOverride: [TESTER_BCC], // Helper expects array
  };

  console.log(`\n--- Starting Tests for User: ${TARGET_USER_ID} ---\n`);
  console.log(`To: ${TESTER_EMAIL}`);
  console.log(`CC: ${TESTER_CC}`);
  console.log(`BCC: ${TESTER_BCC}\n`);

  try {
    console.log('1. Testing assignBlueSquareForTimeNotMet...');
    await userHelper.assignBlueSquareForTimeNotMet(emailConfig);
    console.log('   -> Done.\n');

    console.log('2. Testing completeHoursAndMissedSummary...');
    await userHelper.completeHoursAndMissedSummary(emailConfig);
    console.log('   -> Done.\n');

    // console.log('3. Testing inCompleteHoursEmailFunction...');
    // await userHelper.inCompleteHoursEmailFunction(emailConfig);
    // console.log('   -> Done.\n');

    // console.log('4. Testing weeklyBlueSquareReminderFunction...');
    // await userHelper.weeklyBlueSquareReminderFunction(emailConfig);
    // console.log('   -> Done.\n');

    // console.log('All tests completed successfully.');
  } catch (error) {
    console.error('Error running tests:', error);
  } finally {
    console.log('Closing DB connection...');
    await mongoose.connection.close();
    process.exit(0);
  }
};

runTests();
