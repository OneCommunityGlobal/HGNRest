// IMPORTANT - PLEASE DO NOT RUN THIS UNLESS EXPLICITLY ASKED TO!!
const mongoose = require('mongoose');
require('dotenv').config();
const UserStateSelection = require('../models/userStateSelection');
const { prompt } = require('./scriptUtil');

const RESET_PASSWORD = process.env.RESET_USERSELECTIONS_PASSWORD;

if (!RESET_PASSWORD) {
  console.error('❌ RESET_USERSELECTIONS_PASSWORD env variable is not set. Aborting.');
  process.exit(1);
}

async function reset() {
  const input = await prompt('Enter reset password: ');

  if (input.trim() !== RESET_PASSWORD) {
    console.error('❌ Incorrect password. Aborting.');
    process.exit(1);
  }

  const confirm = await prompt(
    '⚠️  This will permanently delete ALL user state selection entries. Type "yes" to confirm: ',
  );

  if (confirm.trim().toLowerCase() !== 'yes') {
    console.log('Aborted.');
    process.exit(0);
  }

  await mongoose.connect(process.env.MONGO_URI);
  const result = await UserStateSelection.deleteMany({});
  console.log(`✓ Deleted ${result.deletedCount} user state selection entries`);
  await mongoose.disconnect();
}

reset().catch((err) => {
  console.error(err);
  process.exit(1);
});

// PS - PASSWORD PROTECTED, REACH OUT TO DIYA FOR PASSWORD
