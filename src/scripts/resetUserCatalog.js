// IMPORTANT - PLEASE DO NOT RUN THIS UNLESS EXPLICITLY ASKED TO!!
const readline = require('node:readline');
const mongoose = require('mongoose');
const UserStateCatalog = require('../models/userStateCatalog');
const { prompt } = require('./scriptUtil');

const RESET_PASSWORD = process.env.RESET_USERCATALOG_PASSWORD;

if (!RESET_PASSWORD) {
  console.error('❌ RESET_USERCATALOG_PASSWORD env variable is not set. Aborting.');
  process.exit(1);
}

async function reset() {
  const input = await prompt('Enter reset password: ');

  if (input.trim() !== RESET_PASSWORD) {
    console.error('❌ Incorrect password. Aborting.');
    process.exit(1);
  }

  const confirm = await prompt(
    '⚠️  This will permanently delete ALL catalog entries. Type "yes" to confirm: ',
  );

  if (confirm.trim().toLowerCase() !== 'yes') {
    console.log('Aborted.');
    process.exit(0);
  }

  await mongoose.connect(process.env.MONGO_URI);
  const result = await UserStateCatalog.deleteMany({});
  console.log(`✓ Deleted ${result.deletedCount} catalog entries`);
  await mongoose.disconnect();
}

reset().catch((err) => {
  console.error(err);
  process.exit(1);
});

// PS - PASSWORD PROTECTED, REACH OUT TO DIYA FOR PASSWORD
