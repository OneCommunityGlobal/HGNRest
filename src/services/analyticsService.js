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
const StudentGroup = require('../models/studentGroup');
const StudentGroupMember = require('../models/studentGroupMember');
const UserProfile = require('../models/userProfile');

const parseAnalyticsNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || value.trim() === '') return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const calculateMetricsFromResponses = (responses) => {
  let totalScore = 0;
  let scoreCount = 0;
  let totalTime = 0;

  responses.forEach((response) => {
    const numericAnswers = Array.isArray(response.responses)
      ? response.responses
          .map((entry) => parseAnalyticsNumber(entry?.answer))
          .filter((value) => value !== null)
      : [];

    if (numericAnswers.length) {
      totalScore += numericAnswers.reduce((sum, value) => sum + value, 0) / numericAnswers.length;
      scoreCount += 1;
    }

    const timeField = Array.isArray(response.responses)
      ? response.responses.find((entry) => /time(spent)?/i.test(entry?.questionLabel || ''))
      : null;
    const responseTime = parseAnalyticsNumber(timeField?.answer);
    const topLevelTime = parseAnalyticsNumber(response.timeSpentMinutes);
    if (responseTime !== null) totalTime += responseTime;
    if (topLevelTime !== null) totalTime += topLevelTime;
  });

  return {
    averageScore: scoreCount ? Number((totalScore / scoreCount).toFixed(2)) : 0,
    totalTimeSpentMinutes: Math.round(totalTime),
    engagementRate: Math.min(1, responses.length / 10),
  };
};

const buildResponseOverview = (responses) => {
  const responsesByStudent = new Map();

  responses.forEach((response) => {
    const studentId = response.submittedBy;
    if (!studentId) return;
    const studentResponses = responsesByStudent.get(studentId) || [];
    studentResponses.push(response);
    responsesByStudent.set(studentId, studentResponses);
  });

  const studentMetrics = [...responsesByStudent.values()].map(calculateMetricsFromResponses);
  if (!studentMetrics.length) {
    return {
      averageScore: null,
      averageTimeSpentMinutes: null,
      averageEngagementRate: null,
      totalStudents: 0,
    };
  }

  const average = (field, precision) => {
    const value =
      studentMetrics.reduce((sum, metrics) => sum + metrics[field], 0) / studentMetrics.length;
    return Number(value.toFixed(precision));
  };

  return {
    averageScore: average('averageScore', 2),
    averageTimeSpentMinutes: Math.round(
      studentMetrics.reduce((sum, metrics) => sum + metrics.totalTimeSpentMinutes, 0) /
        studentMetrics.length,
    ),
    averageEngagementRate: average('engagementRate', 3),
    totalStudents: studentMetrics.length,
  };
};

const buildTimeSeriesData = (responses) => {
  const responsesByDay = new Map();

  responses.forEach((response) => {
    const submittedAt = new Date(response.submittedAt);
    if (Number.isNaN(submittedAt.getTime())) return;

    const date = submittedAt.toISOString().slice(0, 10);
    const dailyResponses = responsesByDay.get(date) || [];
    dailyResponses.push(response);
    responsesByDay.set(date, dailyResponses);
  });

  return [...responsesByDay.entries()]
    .sort(([firstDate], [secondDate]) => firstDate.localeCompare(secondDate))
    .map(([date, dailyResponses]) => {
      const metrics = buildResponseOverview(dailyResponses);
      return {
        date,
        averageScore: metrics.averageScore,
        timeSpent: dailyResponses.reduce((sum, response) => {
          const responseMetrics = calculateMetricsFromResponses([response]);
          return sum + responseMetrics.totalTimeSpentMinutes;
        }, 0),
        engagementRate: metrics.averageEngagementRate,
      };
    });
};

const getStudentOptions = async () => {
  const studentIds = await FormResponse.distinct('submittedBy');
  if (!studentIds.length) return [];

  const users = await UserProfile.find({ _id: { $in: studentIds } })
    .select('_id firstName lastName')
    .lean();
  return users.map((user) => ({
    id: user._id.toString(),
    name: `${user.firstName} ${user.lastName}`.trim(),
  }));
};

const getClassOptions = async () => {
  const groups = await StudentGroup.find({}).select('_id name').lean();
  return groups.map((group) => ({ id: group._id.toString(), name: group.name }));
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

const getOverview = async ({ studentId, classId, startDate, endDate } = {}) => {
  const hasFilters = Boolean(studentId || classId || startDate || endDate);
  const responseQuery = {};

  if (studentId) responseQuery.submittedBy = studentId;
  if (startDate || endDate) {
    responseQuery.submittedAt = {};
    if (startDate) responseQuery.submittedAt.$gte = startDate;
    if (endDate) responseQuery.submittedAt.$lte = endDate;
  }

  if (classId) {
    const members = await StudentGroupMember.find({ group_id: classId })
      .select('student_id')
      .lean();
    const classStudentIds = members.map((member) => member.student_id.toString());
    responseQuery.submittedBy = studentId
      ? { $in: classStudentIds.filter((id) => id === studentId) }
      : { $in: classStudentIds };
  }

  const [responses, students, classes] = await Promise.all([
    FormResponse.find(responseQuery).lean(),
    getStudentOptions(),
    getClassOptions(),
  ]);

  const timeSeriesData = buildTimeSeriesData(responses);
  if (hasFilters) {
    return { ...buildResponseOverview(responses), students, classes, timeSeriesData };
  }

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
      students,
      classes,
      timeSeriesData,
    };
  }

  // Preserve the existing unfiltered fallback response shape while adding dashboard data.
  const distinctStudents = await FormResponse.distinct('submittedBy');
  return {
    averageScore: 0,
    averageTimeSpentMinutes: 0,
    averageEngagementRate: 0,
    totalStudents: distinctStudents.length || 0,
    totalResponses: responses.length,
    students,
    classes,
    timeSeriesData,
  };
};

module.exports = {
  parseAnalyticsNumber,
  calculateMetricsFromResponses,
  buildTimeSeriesData,
  calculateStudentMetrics,
  refreshStudentMetrics,
  computeStudentMetrics,
  getStudentMetrics,
  getOverview,
};
