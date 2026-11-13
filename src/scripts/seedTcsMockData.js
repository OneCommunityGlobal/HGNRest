/**
 * Load or reset mock data for the Total Construction Summary (BM Dashboard → Reports).
 *
 * Usage (from the HGNRest root):
 *   node src/scripts/seedTcsMockData.js          # reset previous mock data, then load fresh data
 *   node src/scripts/seedTcsMockData.js --reset  # remove the mock data only
 *
 * Safety: the script refuses to run unless the database name contains "dev", "test" or "local"
 * (for example hgnData_dev). Add --force to run against any other database on purpose.
 *
 * Mock data is attached to the existing BM projects (Building 1–3, Residential Test - Project,
 * Commercial Test - Project) and covers the last 8 weeks. Every inserted ID is recorded in the
 * "mockDataManifests" collection, so reset removes only mock records.
 *
 * Requires a valid .env file with the same MongoDB credentials used by the app:
 *   user, password, cluster, dbName, appName
 *
 * Seed logic lives in src/utilities/tcsMockDataSeeder.js.
 */

/* eslint-disable no-console */
require('dotenv').config();
const mongoose = require('mongoose');
const BuildingProject = require('../models/bmdashboard/buildingProject');
const UserProfile = require('../models/userProfile');
const { invTypeBase } = require('../models/bmdashboard/buildingInventoryType');
const BuildingIssue = require('../models/bmdashboard/buildingIssue');
const InjurySeverity = require('../models/bmdashboard/injujrySeverity');
const InjuryCategory = require('../models/bmdashboard/buildingInjury');
const InjuryOverTime = require('../models/bmdashboard/buildingInjuryOverTime');
const RentalChart = require('../models/bmdashboard/buildingRentalChart');
const ToolReturn = require('../models/bmdashboard/toolReturn');
const ToolsDowntime = require('../models/bmdashboard/toolsDowntime');
const ToolStoppageReason = require('../models/bmdashboard/buildingToolsStoppage');
const ToolAvailability = require('../models/bmdashboard/toolAvailability');
const Expenditure = require('../models/bmdashboard/expenditure');
const ProjectCostTracking = require('../models/bmdashboard/projectCostTracking');
const ProjectRiskProfile = require('../models/bmdashboard/projectRiskProfile');
const RiskIssue = require('../models/bmdashboard/Issues');
const TimeLog = require('../models/bmdashboard/buildingTimeLogger');
const NewLesson = require('../models/bmdashboard/buildingNewLesson');
const BuildingMaterial = require('../models/bmdashboard/buildingMaterial');
const BuildingTool = require('../models/bmdashboard/buildingTool');
const ProjectStatus = require('../models/projectStatus');
const LaborCost = require('../models/laborCost');
const Manifest = require('../models/bmdashboard/mockDataManifest');
const { seedTcsMockData, resetTcsMockData } = require('../utilities/tcsMockDataSeeder');

const models = {
  buildingIssue: BuildingIssue,
  injurySeverity: InjurySeverity,
  injuryCategory: InjuryCategory,
  injuryOverTime: InjuryOverTime,
  rentalChart: RentalChart,
  toolReturn: ToolReturn,
  toolsDowntime: ToolsDowntime,
  toolStoppageReason: ToolStoppageReason,
  toolAvailability: ToolAvailability,
  expenditure: Expenditure,
  projectCostTracking: ProjectCostTracking,
  riskIssue: RiskIssue,
  projectRiskProfile: ProjectRiskProfile,
  timeLog: TimeLog,
  newLesson: NewLesson,
  buildingMaterial: BuildingMaterial,
  buildingTool: BuildingTool,
  projectStatus: ProjectStatus,
  laborCost: LaborCost,
};

const { user, password, cluster, dbName, appName = 'HGNRest' } = process.env;

const SAFE_DB_NAME = /dev|test|local/i;

async function run() {
  if (!user || !password || !cluster || !dbName) {
    throw new Error('Missing required env vars: user, password, cluster, dbName');
  }
  if (!SAFE_DB_NAME.test(dbName) && !process.argv.includes('--force')) {
    throw new Error(
      `Refusing to run against database "${dbName}": it does not look like a dev/test database. ` +
        'Pass --force to run anyway.',
    );
  }

  const uri = `mongodb+srv://${user}:${encodeURIComponent(password)}@${cluster}/${dbName}?retryWrites=true&w=majority&appName=${appName}`;
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

  if (process.argv.includes('--reset')) {
    const { removed } = await resetTcsMockData({ models, Manifest });
    console.log(`Removed ${removed} mock record(s)`);
  } else {
    const summary = await seedTcsMockData({
      models,
      BuildingProject,
      UserProfile,
      InventoryType: invTypeBase,
      Manifest,
      createId: () => new mongoose.Types.ObjectId(),
    });
    console.log(`Removed ${summary.removed} previous mock record(s)`);
    if (summary.missingUser) console.warn('No active Administrator found; nothing inserted.');
    Object.entries(summary.inserted).forEach(([key, count]) =>
      console.log(`  - ${key}: ${count} record(s)`),
    );
    console.log(`Projects: ${summary.seededProjects.join(', ') || 'none'}`);
    if (summary.missingProjects.length > 0) {
      console.warn('BM projects not found (skipped):', summary.missingProjects.join(', '));
    }
    if (summary.missingUser || summary.seededProjects.length === 0) {
      console.error(
        'Nothing was seeded: no active Administrator or none of the BM projects found.',
      );
      process.exitCode = 1;
    }
  }

  await mongoose.disconnect();
}

async function main() {
  try {
    await run();
  } catch (err) {
    console.error(err);
    try {
      await mongoose.disconnect();
    } catch (disconnectErr) {
      console.error(disconnectErr);
    }
    process.exitCode = 1;
  }
}

main().catch((err) => console.error(err));
