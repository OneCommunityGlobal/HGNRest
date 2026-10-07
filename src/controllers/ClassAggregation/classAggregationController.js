// controllers/ClassAggregation/classAggregationController.js
const mongoose = require('mongoose');

// ---------------------- Weight Constants ----------------------
const Wc = 0.7;
const Wa = 0.2;
const We = 0.1;

// ---------------------- Helpers ----------------------
async function getStudentsInGroup(groupId) {
  const { db } = mongoose.connection;
  const members = await db
    .collection('studentgroupmembers')
    .find({ groupId: new mongoose.Types.ObjectId(groupId) })
    .toArray();
  return members.map((m) => m.studentId);
}

async function getProfile(studentId) {
  const { db } = mongoose.connection;
  return db
    .collection('education_student_profiles')
    .findOne({ _id: new mongoose.Types.ObjectId(studentId) });
}

async function getMetrics(studentId) {
  const { db } = mongoose.connection;
  const metricsDoc = await db
    .collection('studentMetrics')
    .findOne({ studentId: new mongoose.Types.ObjectId(studentId) });
  return metricsDoc?.metrics || null;
}

// ---------------------- Score Logic ----------------------
async function computeStudentScore(studentId) {
  const profile = await getProfile(studentId);
  const metrics = await getMetrics(studentId);

  if (!profile || !metrics) return null;

  const ps = profile.progressSummary;

  const C = (ps.totalCompleted / ps.totalAtoms) * 100;
  const A = metrics.averageScore;
  const E = metrics.engagementRate;

  return Wc * C + Wa * A + We * E;
}

function performanceCategory(score) {
  if (score >= 85) return 'Excellent';
  if (score >= 60) return 'Satisfactory';
  return 'Needs Improvement';
}

// ---------------------- Group Performance ----------------------
async function computeGroupPerformance(groupId) {
  const studentIds = await getStudentsInGroup(groupId);
  const scores = await Promise.all(studentIds.map((id) => computeStudentScore(id)));
  const validScores = scores.filter((s) => s !== null);

  if (validScores.length === 0) return 0;
  return validScores.reduce((a, b) => a + b, 0) / validScores.length;
}

module.exports = {
  computeStudentScore,
  performanceCategory,
  computeGroupPerformance,
};
