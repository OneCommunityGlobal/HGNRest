// IMPORTANT - PLEASE DO NOT RUN THIS UNLESS EXPLICITLY ASKED TO!!
// One-time backfill: sets datePosted on any Job documents missing it
// (e.g. records created before the field existed, or inserted via a
// path that bypassed the schema default). The date is derived from each
// document's _id, which encodes its creation time.
const mongoose = require('mongoose');
require('dotenv').config();
const Job = require('../models/jobs');

async function backfill() {
  const { user, password, cluster, dbName, appName = 'HGNRest' } = process.env;
  const uri = `mongodb+srv://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${cluster}/${dbName}?retryWrites=true&w=majority&appName=${appName}`;
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

  const result = await Job.updateMany(
    { $or: [{ datePosted: { $exists: false } }, { datePosted: null }] },
    [{ $set: { datePosted: { $toDate: '$_id' } } }],
  );

  console.log(`✓ Backfilled datePosted on ${result.modifiedCount ?? result.nModified} job(s)`);
  await mongoose.disconnect();
}

backfill().catch((err) => {
  console.error(err);
  process.exit(1);
});
