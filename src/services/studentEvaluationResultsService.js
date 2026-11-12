const mongoose = require('mongoose');
const UserProfile = require('../models/userProfile');
const Notification = require('../models/notification');
const StudentEvaluation = require('../models/studentEvaluation');
const EvaluationTask = require('../models/evaluationTask');
const validateEvaluationPublication = require('./evaluationPublishValidation');

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
const toObjectId = (id, errorMessage = 'Invalid student ID provided.') => {
  if (!isValidObjectId(id)) {
    throw new Error(errorMessage);
  }

  return new mongoose.Types.ObjectId(id);
};
const EXCELLENT_THRESHOLD = 85;
const PROFICIENT_THRESHOLD = 70;
const DEVELOPING_THRESHOLD = 50;

const PERFORMANCE_COLORS = {
  excellent: '#1F9D55',
  outstanding: '#1F9D55',
  advanced: '#1F9D55',
  proficient: '#2F80ED',
  good: '#2F80ED',
  satisfactory: '#F2C94C',
  developing: '#F2994A',
  needs_improvement: '#EB5757',
  needsimprovement: '#EB5757',
  at_risk: '#EB5757',
  poor: '#EB5757',
};

function getPerformanceColor(performanceLevel, percentage) {
  const normalizedLevel = String(performanceLevel || '')
    .toLowerCase()
    .replace(/\s+/g, '_');

  if (PERFORMANCE_COLORS[normalizedLevel]) {
    return PERFORMANCE_COLORS[normalizedLevel];
  }

  if (percentage >= EXCELLENT_THRESHOLD) return '#1F9D55';
  if (percentage >= PROFICIENT_THRESHOLD) return '#2F80ED';
  if (percentage >= DEVELOPING_THRESHOLD) return '#F2C94C';
  return '#EB5757';
}

function getAggregatePerformanceLevel(percentage) {
  if (percentage >= EXCELLENT_THRESHOLD) return 'Excellent';
  if (percentage >= PROFICIENT_THRESHOLD) return 'Proficient';
  if (percentage >= DEVELOPING_THRESHOLD) return 'Developing';
  return 'Needs Improvement';
}

function getSubmissionStatus(task) {
  if (!task.submissionDate || !task.dueDate) {
    return 'pending';
  }

  return new Date(task.submissionDate) <= new Date(task.dueDate) ? 'on_time' : 'late';
}

// Read responses preserve missing values without changing publishing normalization.
const availableNumber = (value) => (Number.isFinite(value) && value >= 0 ? value : null);
const availablePercentage = (value) =>
  availableNumber(value) !== null && value <= 100 ? value : null;

// Validate before arithmetic: only explicit zero weights may be excluded.
function calculateOverallScore(categories) {
  if (!categories.length || categories.some((item) => availableNumber(item.weightage) === null)) {
    return null;
  }
  const weightedCategories = categories.filter((item) => item.weightage > 0);
  // Fall back to an unweighted average only when every validated weight is zero.
  const included = weightedCategories.length ? weightedCategories : categories;
  if (included.some((item) => availablePercentage(item.percentage) === null)) return null;

  const totalWeight = weightedCategories.reduce((sum, item) => sum + item.weightage, 0);
  const score = weightedCategories.length
    ? weightedCategories.reduce((sum, item) => sum + item.percentage * item.weightage, 0) /
      totalWeight
    : included.reduce((sum, item) => sum + item.percentage, 0) / included.length;
  return Number.isFinite(score) ? Number(score.toFixed(2)) : null;
}

// Resolve only the recorded author; missing authors must not erase stored feedback.
async function buildTeacherFeedback(student) {
  const feedback = student.educationProfiles.student.evaluationFeedback || {};
  let teacherName = null;
  if (feedback.authorId) {
    const author = await UserProfile.findById(feedback.authorId)
      .select('firstName lastName')
      .lean();
    teacherName = author
      ? [author.firstName, author.lastName].filter(Boolean).join(' ') || null
      : null;
  }
  return {
    teacherName,
    teacherTitle: feedback.teacherTitle || null,
    overall: feedback.overall || null,
    strengths: Array.isArray(feedback.strengths) ? feedback.strengths : [],
    improvements: Array.isArray(feedback.improvements) ? feedback.improvements : [],
    updatedAt: feedback.updatedAt || null,
  };
}

function buildTaskResult(task) {
  return {
    taskId: task._id,
    taskName: task.taskName,
    weightage: task.weightage,
    marks: availableNumber(task.marks),
    maxMarks: availableNumber(task.maxMarks),
    type: task.type || null,
    percentage: availablePercentage(task.percentage),
    status: task.status,
    feedback: task.feedback,
    dueDate: task.dueDate,
    submissionDate: task.submissionDate,
    submissionStatus: getSubmissionStatus(task),
    performanceColor:
      availablePercentage(task.percentage) === null
        ? null
        : getPerformanceColor(null, task.percentage),
  };
}

function buildCategoryResult(evaluation, categoryTasks) {
  return {
    evaluationId: evaluation._id,
    category: evaluation.category,
    weightage: evaluation.weightage,
    totalItems: evaluation.totalItems,
    completedItems: evaluation.completedItems,
    marks: availableNumber(evaluation.marks),
    maxMarks: availableNumber(evaluation.maxMarks),
    percentage: availablePercentage(evaluation.percentage),
    performanceLevel: evaluation.performanceLevel,
    performanceColor:
      availablePercentage(evaluation.percentage) === null
        ? null
        : getPerformanceColor(evaluation.performanceLevel, evaluation.percentage),
    feedback: evaluation.feedback,
    createdAt: evaluation.createdAt,
    updatedAt: evaluation.updatedAt,
    tasks: categoryTasks.map(buildTaskResult),
  };
}

function summarizeCategoryTasks(tasks) {
  return tasks.reduce(
    (summary, task) => {
      const isCompleted = ['completed', 'graded', 'submitted'].includes(
        String(task.status || '').toLowerCase(),
      );

      if (isCompleted) {
        summary.completedTasks += 1;
      }

      const submissionStatus = getSubmissionStatus(task);
      if (submissionStatus === 'on_time') {
        summary.onTimeSubmissions += 1;
      }
      if (submissionStatus === 'late') {
        summary.lateSubmissions += 1;
      }

      return summary;
    },
    {
      completedTasks: 0,
      onTimeSubmissions: 0,
      lateSubmissions: 0,
    },
  );
}

async function getValidatedStudent(studentId) {
  const studentObjectId = toObjectId(studentId);

  const student = await UserProfile.findById(studentObjectId)
    .select(
      'firstName lastName role educationProfiles.student.lastEvaluationResultsViewedAt educationProfiles.student.evaluationFeedback',
    )
    .lean();

  if (!student?.educationProfiles?.student) {
    throw new Error('Student profile not found.');
  }

  return student;
}

async function getStudentEvaluationResults(studentId) {
  const student = await getValidatedStudent(studentId);
  const teacherFeedback = await buildTeacherFeedback(student);
  const studentObjectId = toObjectId(studentId);

  const evaluations = await StudentEvaluation.find({ studentId: studentObjectId })
    .sort({ updatedAt: -1, category: 1 })
    .lean();

  if (!evaluations.length) {
    return {
      summary: {
        overallScore: null,
        averageScore: null,
        earnedMarks: null,
        maxMarks: null,
        totalCategories: 0,
        totalTasks: 0,
        completedTasks: 0,
        onTimeSubmissions: 0,
        lateSubmissions: 0,
        performanceLevel: null,
        performanceColor: null,
        lastPublishedAt: null,
      },
      categories: [],
      taskResults: [],
      teacherFeedback,
    };
  }

  const evaluationIds = evaluations.map((evaluation) => evaluation._id);
  const tasks = await EvaluationTask.find({ evaluationId: { $in: evaluationIds } })
    .sort({ dueDate: 1, createdAt: 1 })
    .lean();

  const tasksByEvaluationId = tasks.reduce((accumulator, task) => {
    const key = task.evaluationId.toString();
    if (!accumulator[key]) {
      accumulator[key] = [];
    }
    accumulator[key].push(task);
    return accumulator;
  }, {});

  let totalTasks = 0;
  let completedTasks = 0;
  let onTimeSubmissions = 0;
  let lateSubmissions = 0;

  const categories = evaluations.map((evaluation) => {
    const categoryTasks = tasksByEvaluationId[evaluation._id.toString()] || [];
    const taskSummary = summarizeCategoryTasks(categoryTasks);
    totalTasks += categoryTasks.length;
    completedTasks += taskSummary.completedTasks;
    onTimeSubmissions += taskSummary.onTimeSubmissions;
    lateSubmissions += taskSummary.lateSubmissions;

    return buildCategoryResult(evaluation, categoryTasks);
  });

  const overallScore = calculateOverallScore(categories);
  // The task average is separate from the weighted overall grade; omit unknown scores.
  const scoredTasks = tasks
    .map((task) => availablePercentage(task.percentage))
    .filter((score) => score !== null);
  const averageScore = scoredTasks.length
    ? Number((scoredTasks.reduce((sum, score) => sum + score, 0) / scoredTasks.length).toFixed(2))
    : null;
  // Return aggregate marks only when every category supplies both sides of the total.
  const completeMarks = categories.every((item) => item.marks !== null && item.maxMarks !== null);

  return {
    summary: {
      overallScore,
      averageScore,
      earnedMarks: completeMarks ? categories.reduce((sum, item) => sum + item.marks, 0) : null,
      maxMarks: completeMarks ? categories.reduce((sum, item) => sum + item.maxMarks, 0) : null,
      totalCategories: categories.length,
      totalTasks,
      completedTasks,
      onTimeSubmissions,
      lateSubmissions,
      performanceLevel: overallScore === null ? null : getAggregatePerformanceLevel(overallScore),
      performanceColor: overallScore === null ? null : getPerformanceColor(null, overallScore),
      lastPublishedAt: categories.reduce((latest, category) => {
        if (!latest || new Date(category.updatedAt) > new Date(latest)) {
          return category.updatedAt;
        }
        return latest;
      }, null),
    },
    categories,
    teacherFeedback,
    taskResults: categories.flatMap((category) =>
      category.tasks.map((task) => ({
        ...task,
        evaluationId: category.evaluationId,
        category: category.category,
      })),
    ),
  };
}

async function getEvaluationResultNotifications(studentId) {
  const student = await getValidatedStudent(studentId);
  const studentObjectId = toObjectId(studentId);
  const lastViewedAt = student.educationProfiles.student.lastEvaluationResultsViewedAt || null;

  const notifications = await Notification.find({
    recipient: studentObjectId,
    type: 'evaluation_results',
  })
    .sort({ createdTimeStamps: -1 })
    .lean();

  const latestNotification = notifications[0] || null;
  const hasNewResults = notifications.some((notification) => {
    if (!lastViewedAt) return true;
    return new Date(notification.createdTimeStamps) > new Date(lastViewedAt);
  });

  return {
    hasNewResults,
    unreadCount: notifications.filter((notification) => !notification.isRead).length,
    lastViewedAt,
    latestNotificationAt: latestNotification ? latestNotification.createdTimeStamps : null,
  };
}

async function markEvaluationResultsViewed(studentId, viewedAt = new Date()) {
  const studentObjectId = toObjectId(studentId);
  const updatedStudent = await UserProfile.findByIdAndUpdate(
    studentObjectId,
    {
      $set: {
        'educationProfiles.student.lastEvaluationResultsViewedAt': viewedAt,
      },
    },
    {
      new: true,
    },
  );

  await Notification.updateMany(
    {
      recipient: studentObjectId,
      type: 'evaluation_results',
      isRead: false,
    },
    {
      $set: { isRead: true },
    },
  );

  return updatedStudent;
}

// Every write uses the same session and runs sequentially; failures roll back the publication.
async function persistCategory(evaluation, studentId, teacherId, session) {
  const { tasks, ...fields } = evaluation;
  const persisted = await StudentEvaluation.findOneAndUpdate(
    { studentId, category: fields.category },
    { $set: { ...fields, publishedBy: teacherId } },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true, session },
  );
  await EvaluationTask.deleteMany({ evaluationId: persisted._id }, { session });
  if (tasks.length) {
    await EvaluationTask.insertMany(
      tasks.map((item) => ({ ...item, evaluationId: persisted._id })),
      { session },
    );
  }
  return persisted;
}

async function publishStudentEvaluationResults(payload) {
  const validated = validateEvaluationPublication(payload);
  await getValidatedStudent(validated.studentObjectId);
  const session = await mongoose.startSession();
  let persistedEvaluations;
  try {
    // The driver retries transient transactions and retries only commit when its outcome is uncertain.
    await session.withTransaction(async () => {
      // Promise chaining avoids parallel operations on a transaction's session.
      persistedEvaluations = await validated.evaluations.reduce(async (previous, evaluation) => {
        const persisted = await previous;
        persisted.push(
          await persistCategory(
            evaluation,
            validated.studentObjectId,
            validated.teacherObjectId,
            session,
          ),
        );
        return persisted;
      }, Promise.resolve([]));
      const updates = { 'educationProfiles.student.lastEvaluationResultsViewedAt': null };
      if (validated.teacherFeedback !== undefined) {
        updates['educationProfiles.student.evaluationFeedback'] = {
          ...validated.teacherFeedback,
          authorId: validated.teacherObjectId,
          updatedAt: new Date(),
        };
      }
      const student = await UserProfile.findByIdAndUpdate(
        validated.studentObjectId,
        { $set: updates },
        { new: true, runValidators: true, session },
      );
      if (!student) throw new Error('Student profile not found.');
      await Notification.create(
        [
          {
            message: validated.message,
            sender: validated.teacherObjectId,
            recipient: validated.studentObjectId,
            type: 'evaluation_results',
            metadata: { categories: persistedEvaluations.map((item) => item.category) },
            isSystemGenerated: false,
          },
        ],
        { session },
      );
    });
    return persistedEvaluations;
  } finally {
    try {
      await session.endSession();
    } catch (cleanupError) {
      // Cleanup must not mask a transaction error or a successful publication.
    }
  }
}

module.exports = {
  getPerformanceColor,
  getStudentEvaluationResults,
  getEvaluationResultNotifications,
  markEvaluationResultsViewed,
  publishStudentEvaluationResults,
};
