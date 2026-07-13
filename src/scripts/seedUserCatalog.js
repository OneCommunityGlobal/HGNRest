const mongoose = require('mongoose');
require('dotenv').config();
const UserStateCatalog = require('../models/userStateCatalog');

const SEED_STATES = [
  { key: 'new-developer', label: 'New Developer', emoji: '🆕', color: '#3498db', order: 0 },
  { key: 'developer', label: 'Developer', emoji: '✅', color: '#27ae60', order: 1 },
  { key: 'pr-review-team', label: 'PR Review Team', emoji: '👀', color: '#9b59b6', order: 2 },
  { key: 'task-requested', label: 'Task Requested', emoji: '💪', color: '#e67e22', order: 3 },
  {
    key: 'flagged-for-followup',
    label: 'Flagged for Followup',
    emoji: '🚩',
    color: '#f1c40f',
    order: 4,
  },
  { key: 'closing-out', label: 'Closing Out', emoji: '🔒', color: '#e74c3c', order: 5 },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB, starting seed!');

  let inserted = 0;
  let skipped = 0;

  for (const state of SEED_STATES) {
    const existing = await UserStateCatalog.findOne({ key: state.key });
    if (existing) {
      console.log(`⏭️  Skipped (already exists): ${state.key}`);
      skipped += 1;
      continue;
    }
    await UserStateCatalog.create(state);
    console.log(`✓ Inserted: ${state.key}`);
    inserted += 1;
  }

  console.log(`\nSeed complete — ${inserted} inserted, ${skipped} skipped`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
