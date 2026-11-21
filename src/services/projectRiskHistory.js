// v1.1.0
const Profile = require('../models/bmdashboard/projectRiskProfile');
const Observation = require('../models/bmdashboard/projectRiskObservation');
const BuildingProject = require('../models/bmdashboard/buildingProject');
const BuildingIssue = require('../models/bmdashboard/buildingIssue');
const { calculateRiskMetrics } = require('../utilities/projectRiskMetrics');

async function issueCount(profile, createdAtRange) {
  if (!(await BuildingProject.exists({ _id: profile.projectId }))) return null;
  const query = { projectId: profile.projectId, status: { $ne: 'closed' } };
  if (createdAtRange) query.issueDate = createdAtRange;
  return BuildingIssue.countDocuments(query);
}

async function recordObservation(profile, now = new Date()) {
  const totalOpenIssues = await issueCount(profile);
  // Unmatched legacy profiles and their saved history remain untouched.
  if (totalOpenIssues === null) return;
  const date = new Date(now);
  date.setUTCHours(0, 0, 0, 0);
  const observation = {
    profileId: profile._id,
    date,
    recordedAt: now,
    ...calculateRiskMetrics(profile, now),
    totalOpenIssues,
  };
  const key = { profileId: profile._id, date };
  const currentOrOlder = {
    ...key,
    $or: [{ recordedAt: { $lte: now } }, { recordedAt: { $exists: false } }],
  };
  try {
    await Observation.updateOne(
      currentOrOlder,
      { $set: observation },
      { upsert: true, runValidators: true },
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
    // Another server may have inserted today's observation concurrently.
    await Observation.updateOne(currentOrOlder, { $set: observation }, { runValidators: true });
  }
}

async function captureDailyRisk(now = new Date()) {
  await Profile.find()
    .cursor()
    .eachAsync((profile) => recordObservation(profile, now), { parallel: 2 });
}

module.exports = { issueCount, recordObservation, captureDailyRisk };
