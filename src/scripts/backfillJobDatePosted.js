// IMPORTANT - PLEASE DO NOT RUN THIS UNLESS EXPLICITLY ASKED TO!!
// One-time backfill: sets datePosted on any Job documents missing it
// (e.g. records created before the field existed, or inserted via a
// path that bypassed the schema default).
const mongoose = require('mongoose');
require('dotenv').config();
const Job = require('../models/jobs');

async function backfill() {
  await mongoose.connect(process.env.MONGO_URI);

  const result = await Job.updateMany(
    { $or: [{ datePosted: { $exists: false } }, { datePosted: null }] },
    { $set: { datePosted: new Date() } },
  );

  console.log(`✓ Backfilled datePosted on ${result.modifiedCount} job(s)`);
  await mongoose.disconnect();
}

backfill().catch((err) => {
  console.error(err);
  process.exit(1);
});
