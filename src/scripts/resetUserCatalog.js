// IMPORTANT - PLEASE DO NOT RUN THIS UNLESS EXPLICITLY ASKED TO!!
const mongoose = require('mongoose');
require('dotenv').config();
const readline = require('readline');
const UserStateCatalog = require('../models/userStateCatalog');

const RESET_PASSWORD = process.env.RESET_USERCATALOG_PASSWORD;

if (!RESET_PASSWORD) {
  console.error('❌ RESET_USERCATALOG_PASSWORD env variable is not set. Aborting.');
  process.exit(1);
}

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function reset() {
  const input = await prompt('Enter reset password: ');

  if (input.trim() !== RESET_PASSWORD) {
    console.error('❌ Incorrect password. Aborting.');
    process.exit(1);
  }

  const confirm = await prompt(
    `⚠️  This will permanently delete ALL catalog entries. Type "yes" to confirm: `,
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
