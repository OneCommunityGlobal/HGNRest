/**
 * Seed ToolReplacement docs linked to real BM buildingProjects.
 *
 * Usage (from the HGNRest root):
 *   node src/scripts/seedToolReplacements.js
 *
 * Requires a valid .env file with the same MongoDB credentials used by the app:
 *   user, password, cluster, dbName, appName
 *
 * Looks up BM projects by name (Building 1/2/3, Residential/Commercial Test)
 * and inserts multiple tools per project. Orphan / previous seed rows for those
 * project IDs are replaced so filters on /api/tools/replacements?projectId=... work.
 */

/* eslint-disable no-console */
require('dotenv').config();
const mongoose = require('mongoose');
const BuildingProject = require('../models/bmdashboard/buildingProject');
const ToolReplacement = require('../models/toolReplacement');

const { user, password, cluster, dbName, appName = 'HGNRest' } = process.env;
if (!user || !password || !cluster || !dbName) {
  console.error('❌ Missing required env vars: user, password, cluster, dbName');
  console.error('   Ensure your .env file is present and complete.');
  process.exit(1);
}

const MONGO_URI = `mongodb+srv://${user}:${encodeURIComponent(password)}@${cluster}/${dbName}?retryWrites=true&w=majority&appName=${appName}`;

/** Multiple tools per real BM project name — same names may repeat across projects */
const PROJECT_TOOLS = {
  'Building 1': [
    { toolName: 'Pliers', requirementSatisfiedPercentage: 42 },
    { toolName: 'Screwdriver', requirementSatisfiedPercentage: 75 },
    { toolName: 'Utility knife', requirementSatisfiedPercentage: 90 },
    { toolName: 'Hammer', requirementSatisfiedPercentage: 96 },
  ],
  'Building 2': [
    { toolName: 'Tape measure', requirementSatisfiedPercentage: 38 },
    { toolName: 'Socket Wrench', requirementSatisfiedPercentage: 75 },
    { toolName: 'Flathead screwdriver', requirementSatisfiedPercentage: 90 },
    { toolName: 'Pliers', requirementSatisfiedPercentage: 96 },
  ],
  'Building 3': [
    { toolName: 'Circular saw', requirementSatisfiedPercentage: 28 },
    { toolName: 'Level', requirementSatisfiedPercentage: 55 },
    { toolName: 'Crowbar', requirementSatisfiedPercentage: 80 },
    { toolName: 'Drill', requirementSatisfiedPercentage: 94 },
  ],
  'Residential Test - Project': [
    { toolName: 'Paint roller', requirementSatisfiedPercentage: 35 },
    { toolName: 'Caulking gun', requirementSatisfiedPercentage: 68 },
    { toolName: 'Putty knife', requirementSatisfiedPercentage: 85 },
    { toolName: 'Sandpaper pack', requirementSatisfiedPercentage: 97 },
  ],
  'Commercial Test - Project': [
    { toolName: 'Angle grinder', requirementSatisfiedPercentage: 22 },
    { toolName: 'Pipe wrench', requirementSatisfiedPercentage: 60 },
    { toolName: 'Torque wrench', requirementSatisfiedPercentage: 78 },
    { toolName: 'Wire stripper', requirementSatisfiedPercentage: 91 },
  ],
};

const seedDate = new Date('2025-06-15T12:00:00.000Z');

async function seed() {
  await mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log('Connected to MongoDB — seeding tool replacements…');

  const projectNames = Object.keys(PROJECT_TOOLS);
  const projects = await BuildingProject.find({ name: { $in: projectNames } }, '_id name').lean();
  const projectByName = new Map(projects.map((p) => [p.name, p]));

  const missing = projectNames.filter((name) => !projectByName.has(name));
  if (missing.length > 0) {
    console.warn('⚠️  BM projects not found (skipped):', missing.join(', '));
    console.warn('   Create these in buildingProjects or adjust PROJECT_TOOLS names.');
  }

  const foundProjects = projectNames.filter((name) => projectByName.has(name));
  if (foundProjects.length === 0) {
    console.error('❌ No matching BM projects found. Aborting seed.');
    await mongoose.disconnect();
    process.exit(1);
  }

  const projectIds = foundProjects.map((name) => projectByName.get(name)._id);
  const allBmProjectIds = (await BuildingProject.find({}, '_id').lean()).map((p) => p._id);

  // Remove prior rows for these projects plus any orphan projectIds not in BM projects
  const deleteResult = await ToolReplacement.deleteMany({
    $or: [{ projectId: { $in: projectIds } }, { projectId: { $nin: allBmProjectIds } }],
  });
  console.log(`Removed ${deleteResult.deletedCount} existing/orphan tool-replacement row(s)`);

  const docs = [];
  foundProjects.forEach((name) => {
    const project = projectByName.get(name);
    PROJECT_TOOLS[name].forEach((tool) => {
      docs.push({
        toolName: tool.toolName,
        requirementSatisfiedPercentage: tool.requirementSatisfiedPercentage,
        projectId: project._id,
        date: seedDate,
      });
    });
  });

  const inserted = await ToolReplacement.insertMany(docs);
  console.log(
    `✓ Inserted ${inserted.length} tool-replacement row(s) across ${foundProjects.length} project(s):`,
  );
  foundProjects.forEach((name) => {
    const id = projectByName.get(name)._id.toString();
    const count = PROJECT_TOOLS[name].length;
    console.log(`  - ${name} (${id}): ${count} tools`);
  });

  // Quick verification
  const sampleId = projectIds[0];
  const sampleCount = await ToolReplacement.countDocuments({ projectId: sampleId });
  const totalCount = await ToolReplacement.countDocuments({ projectId: { $in: projectIds } });
  console.log(
    `\nVerify: project ${sampleId} → ${sampleCount} tools; all target projects → ${totalCount} tools`,
  );
  console.log('Seed complete.');

  await mongoose.disconnect();
}

seed().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch (disconnectErr) {
    // ignore
  }
  process.exit(1);
});
