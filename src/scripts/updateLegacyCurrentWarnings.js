require('dotenv').config();
const mongoose = require('mongoose');
const currentWarnings = require('../models/currentWarnings');

const { user, password, cluster, dbName, appName = 'HGNRest' } = process.env;

async function run() {
  if (!user || !password || !cluster || !dbName) {
    throw new Error('Missing required env vars: user, password, cluster, dbName');
  }

  const uri = `mongodb+srv://${user}:${encodeURIComponent(password)}@${cluster}/${dbName}?retryWrites=true&w=majority&appName=${appName}`;
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

  const isMissing = (value) => value === null || value === undefined || value === -1;

  const normalizeWarningTitle = (warningTitle /* : string */) => warningTitle.toLowerCase().trim();

  const warnings = await currentWarnings.find({}).sort({ order: 1, _id: 1 }).lean();
  console.log(`Found ${warnings.length} warning records.`);

  const updates = [];

  warnings.forEach((warning, index) => {
    const fieldsToSet = {
      // Reassigning orderSequence for clean slate and incase of
      // duplicate orderSequence
      orderSequence: index,
    };

    // Repair only missing ones.
    // Preserve existing order values.
    if (isMissing(warning.order)) {
      fieldsToSet.order = index;
    }

    // Preserve the existing helper's description behavior.
    if (isMissing(warning.description)) {
      fieldsToSet.description = 'No description provided yet';
    }

    // Preserve any existing helper's normalizedWarningTitle.
    if (isMissing(warning.normalizedWarningTitle)) {
      fieldsToSet.normalizedWarningTitle = normalizeWarningTitle(warning.warningTitle);
    }

    updates.push({
      updateOne: {
        filter: { _id: warning._id },
        update: { $set: fieldsToSet },
      },
    });
  });

  // Use this to verify migration of intended test warnings are
  // updated properly

  console.log(`Records requiring updates: ${updates.length}`);

  if (updates.length > 0) {
    const result = await currentWarnings.bulkWrite(updates);

    console.log('Matched:', result.matchedCount);
    console.log('Modified:', result.modifiedCount);
  }

  const migratedWarnings = await currentWarnings.find({}).lean();

  const missingOrder = migratedWarnings.filter((warning) => isMissing(warning.order));

  const missingSequence = migratedWarnings.filter((warning) => isMissing(warning.orderSequence));

  const missingDescription = migratedWarnings.filter((warning) => isMissing(warning.description));

  const missingNormalizedWarningTitle = migratedWarnings.filter((warning) =>
    isMissing(warning.normalizedWarningTitle),
  );

  const sequences = migratedWarnings.map((warning) => warning.orderSequence);

  const duplicateSequences = sequences.filter(
    (sequence, index) => sequences.indexOf(sequence) !== index,
  );

  // log for any warning trackers that had failed to be updated properly
  console.log({
    total: migratedWarnings.length,
    missingOrder: missingOrder.length,
    missingSequence: missingSequence.length,
    missingDescription: missingDescription.length,
    missingNormalizedWarningTitle: missingNormalizedWarningTitle.length,
    duplicateSequences: [...new Set(duplicateSequences)],
  });

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
