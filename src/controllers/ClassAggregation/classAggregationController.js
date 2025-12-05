const {
  studentGroups,
  studentGroupMembers,
  educationStudentProfile,
  studentMetrics,
} = require('./mockData');

// ---------------------- Helpers ----------------------

function getStudentsInGroup(groupId) {
  return studentGroupMembers.filter((m) => m.groupId === groupId).map((m) => m.studentId);
}

function getProfile(studentId) {
  return educationStudentProfile.find((p) => p.studentId === studentId);
}

function getMetrics(studentId) {
  return studentMetrics[studentId];
}

// ---------------------- Score Logic ----------------------

const Wc = 0.7;
const Wa = 0.2;
const We = 0.1;

function computeStudentScore(studentId) {
  const profile = getProfile(studentId);
  const metrics = getMetrics(studentId);

  if (!profile || !metrics) return null;

  const ps = profile.progressSummary;

  // Completion %
  const C = (ps.totalCompleted / ps.totalAtoms) * 100;

  const A = metrics.averageScore;
  const E = metrics.engagementRate;

  const score = Wc * C + Wa * A + We * E;
  return score;
}

function performanceCategory(score) {
  if (score >= 85) return 'Excellent';
  if (score >= 60) return 'Satisfactory';
  return 'Needs Improvement';
}

// ---------------------- Group Performance ----------------------

function computeGroupPerformance(groupId) {
  const students = getStudentsInGroup(groupId);

  const scores = students.map((s) => computeStudentScore(s)).filter((s) => s !== null);

  if (scores.length === 0) return 0;

  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

// ---------------------- Evaluate All Groups ----------------------

function evaluateAllGroups() {
  return studentGroups.map((g) => {
    const performance = computeGroupPerformance(g.groupId);

    return {
      groupId: g.groupId,
      groupName: g.groupName,
      performance,
      performanceCategory: performanceCategory(performance),
    };
  });
}

module.exports = {
  computeStudentScore,
  performanceCategory,
  computeGroupPerformance,
  evaluateAllGroups,
};
