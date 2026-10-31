// v1.0.0
const Profile = require('../models/bmdashboard/projectRiskProfile');
const Observation = require('../models/bmdashboard/projectRiskObservation');
const Issue = require('../models/bmdashboard/Issues');
const { calculateRiskMetrics } = require('../utilities/projectRiskMetrics');

async function issueCount(profile, createdAtRange) {
  const ids = profile.issues?.length ? profile.issues : [profile.projectId];
  const query = { _id: { $in: ids } };
  if (createdAtRange) query.createdAt = createdAtRange;
  const issues = await Issue.find(query).lean();
  if (!createdAtRange && issues.length !== new Set(ids.map(String)).size) return null;
  const counts = issues.flatMap((issue) => [
    issue.equipmentIssues ?? 0,
    issue.laborIssues ?? 0,
    issue.materialIssues ?? 0,
  ]);
  return counts.every((n) => Number.isInteger(n) && n >= 0)
    ? counts.reduce((sum, n) => sum + n, 0)
    : null;
}

async function recordObservation(profile, now = new Date()) {
  const date = new Date(now);
  date.setUTCHours(0, 0, 0, 0);
  const observation = {
    profileId: profile._id,
    date,
    recordedAt: now,
    ...calculateRiskMetrics(profile, now),
    totalOpenIssues: await issueCount(profile),
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
