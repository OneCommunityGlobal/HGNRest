/**
 * Seed ToolReplacement docs linked to real BM buildingProjects.
 *
 * Usage (from the HGNRest root):
 *   node src/scripts/seedToolReplacements.js
 *
 * Requires a valid .env file with the same MongoDB credentials used by the app:
 *   user, password, cluster, dbName, appName
 *
 * Seed logic lives in src/utilities/toolReplacementSeeder.js.
 */

/* eslint-disable no-console */
require('dotenv').config();
const mongoose = require('mongoose');
const BuildingProject = require('../models/bmdashboard/buildingProject');
const ToolReplacement = require('../models/toolReplacement');
const { seedToolReplacements } = require('../utilities/toolReplacementSeeder');

const { user, password, cluster, dbName, appName = 'HGNRest' } = process.env;

async function run() {
  if (!user || !password || !cluster || !dbName) {
    throw new Error('Missing required env vars: user, password, cluster, dbName');
  }

  const uri = `mongodb+srv://${user}:${encodeURIComponent(password)}@${cluster}/${dbName}?retryWrites=true&w=majority&appName=${appName}`;
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

  const summary = await seedToolReplacements({ BuildingProject, ToolReplacement });
  console.log(`Removed ${summary.removed} existing/orphan tool-replacement row(s)`);
  console.log(
    `Inserted ${summary.inserted} row(s) across ${summary.seededProjects.length} project(s):`,
  );
  summary.seededProjects.forEach(({ name, id, toolCount }) =>
    console.log(`  - ${name} (${id}): ${toolCount} tools`),
  );
  if (summary.missingProjects.length > 0) {
    console.warn('BM projects not found (skipped):', summary.missingProjects.join(', '));
  }

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
