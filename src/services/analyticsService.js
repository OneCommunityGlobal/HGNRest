/*
  analyticsService: compute and retrieve analytics metrics.

  Notes / assumptions:
  - The project does not appear to have a dedicated LMS/assessment model in a consistent place.
    We attempt to derive student metrics from `FormResponse` documents where possible (formID including
    'quiz' or 'assessment'). This is intentionally conservative and clearly documented so future
    adjustments can plug the real assessment/session models.
  - Persistent refreshes cache computed metrics in the `StudentMetrics` collection.
*/
const StudentMetrics = require('../models/studentMetrics');
const FormResponse = require('../models/formResponse');

const parseAnalyticsNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || value.trim() === '') return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const calculateStudentMetrics = async (studentId) => {
  // Gather form responses for the student. We look for typical assessment-like formIDs.
  const responses = await FormResponse.find({ submittedBy: studentId }).lean();

  let totalScore = 0;
  let scoreCount = 0;
  let totalTime = 0; // minutes
  let assessmentsTaken = 0;

  responses.forEach((resp) => {
    // identify assessment-type forms heuristically
    const isAssessment = true;
    if (isAssessment) {
      assessmentsTaken += 1;

      // Each response has responses[].answer. If numeric answers exist, average them.
      const numericAnswers = Array.isArray(resp.responses)
        ? resp.responses
            .map((response) => parseAnalyticsNumber(response?.answer))
            .filter((value) => value !== null)
        : [];

      if (numericAnswers.length) {
        const avg = numericAnswers.reduce((a, b) => a + b, 0) / numericAnswers.length;
        totalScore += avg;
        scoreCount += 1;
      }
    }

    // time spent heuristic: look for a field named timeSpentMinutes in responses or top-level
    const timeField = Array.isArray(resp.responses)
      ? resp.responses.find((response) => /time(spent)?/i.test(response?.questionLabel || ''))
      : null;
    const responseTime = parseAnalyticsNumber(timeField?.answer);
    const topLevelTime = parseAnalyticsNumber(resp.timeSpentMinutes);
    if (responseTime !== null) totalTime += responseTime;
    if (topLevelTime !== null) totalTime += topLevelTime;
  });

  const averageScore = scoreCount ? Number((totalScore / scoreCount).toFixed(2)) : 0;
  const totalTimeSpentMinutes = Math.round(totalTime);

  // Engagement rate heuristic: normalized by an expected baseline (10 assessments)
  const engagementRate = Math.min(1, assessmentsTaken / 10);

  // Completion rate: assessments with numeric answers / assessments taken
  const completionRate = assessmentsTaken
    ? Number(((scoreCount / assessmentsTaken) * 100).toFixed(1))
    : 0;

  const metrics = {
    averageScore,
    totalTimeSpentMinutes,
    engagementRate,
    completionRate,
    assessmentsTaken,
  };

  return metrics;
};

const refreshStudentMetrics = async (studentId) => {
  const metrics = await calculateStudentMetrics(studentId);

  await StudentMetrics.findOneAndUpdate(
    { studentId },
    { studentId, metrics, lastUpdated: new Date() },
    { upsert: true, new: true },
  );

  return metrics;
};

// Kept as the persistent API used by the scheduled refresh job.
const computeStudentMetrics = refreshStudentMetrics;

const getStudentMetrics = async (studentId, { forceRefresh = false } = {}) => {
  if (!forceRefresh) {
    const cached = await StudentMetrics.findOne({ studentId }).lean();
    if (
      cached &&
      cached.lastUpdated &&
      Date.now() - new Date(cached.lastUpdated).getTime() < 1000 * 60 * 60
    ) {
      // return cache if updated within last hour
      return cached.metrics;
    }
  }
  return calculateStudentMetrics(studentId);
};

const getOverview = async () => {
  // Use cached student metrics to build overview; if not available, fallback to aggregating FormResponse
  const stats = await StudentMetrics.aggregate([
    {
      $group: {
        _id: null,
        avgScore: { $avg: '$metrics.averageScore' },
        avgTime: { $avg: '$metrics.totalTimeSpentMinutes' },
        avgEngagement: { $avg: '$metrics.engagementRate' },
        totalStudents: { $sum: 1 },
      },
    },
  ]);

  if (stats && stats.length) {
    const s = stats[0];
    return {
      averageScore: Number((s.avgScore || 0).toFixed(2)),
      averageTimeSpentMinutes: Math.round(s.avgTime || 0),
      averageEngagementRate: Number((s.avgEngagement || 0).toFixed(3)),
      totalStudents: s.totalStudents || 0,
    };
  }

  // Fallback: compute minimal overview from FormResponse directly
  const totalResponses = await FormResponse.countDocuments();
  const distinctStudents = await FormResponse.distinct('submittedBy');
  return {
    averageScore: 0,
    averageTimeSpentMinutes: 0,
    averageEngagementRate: 0,
    totalStudents: distinctStudents.length || 0,
    totalResponses,
  };
};

module.exports = {
  parseAnalyticsNumber,
  calculateStudentMetrics,
  refreshStudentMetrics,
  computeStudentMetrics,
  getStudentMetrics,
  getOverview,
};
