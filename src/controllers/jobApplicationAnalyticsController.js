const mongoose = require('mongoose');
const Response = require('../models/jobApplicationsModel');
const Form = require('../models/JobFormsModel');
const { canManageJobForms } = require('../utilities/jobFormPermissions');

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 25;

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildListMatch(query = {}) {
  const match = {};

  if (query.formId && mongoose.Types.ObjectId.isValid(query.formId)) {
    match.formId = new mongoose.Types.ObjectId(query.formId);
  }

  const from = query.from ? new Date(query.from) : null;
  const to = query.to ? new Date(query.to) : null;
  if ((from && !Number.isNaN(from.getTime())) || (to && !Number.isNaN(to.getTime()))) {
    match.submittedAt = {};
    if (from && !Number.isNaN(from.getTime())) match.submittedAt.$gte = from;
    if (to && !Number.isNaN(to.getTime())) match.submittedAt.$lte = to;
  }

  const q = String(query.q || '').trim();
  if (q) {
    const pattern = escapeRegex(q);
    match.$or = [
      { email: { $regex: pattern, $options: 'i' } },
      { respondent: { $regex: pattern, $options: 'i' } },
    ];
  }

  return match;
}

function fillWeekdayCounts(rows = []) {
  const byDay = new Map(rows.map((row) => [Number(row._id), row.count]));
  // Mongo $dayOfWeek: 1=Sun … 7=Sat
  return WEEKDAY_LABELS.map((label, index) => ({
    label,
    count: byDay.get(index + 1) || 0,
  }));
}

function fillHourCounts(rows = []) {
  const byHour = new Map(rows.map((row) => [Number(row._id), row.count]));
  return Array.from({ length: 24 }, (_, hour) => ({
    label: `${String(hour).padStart(2, '0')}:00`,
    count: byHour.get(hour) || 0,
  }));
}

function bucketHours(value) {
  if (!Number.isFinite(value) || value <= 0) return null;
  if (value < 10) return '< 10 hrs/week';
  if (value < 20) return '10–19 hrs/week';
  if (value < 30) return '20–29 hrs/week';
  return '30+ hrs/week';
}

function bucketCommitment(value) {
  if (!Number.isFinite(value) || value <= 0) return null;
  if (value < 2) return '< 2 months';
  if (value < 3) return '2–3 months';
  if (value < 6) return '3–6 months';
  return '6+ months';
}

function normalizeBucketRows(rows = []) {
  return rows
    .filter((row) => row && row.label)
    .map((row) => ({ label: row.label, count: row.count || 0 }))
    .sort((a, b) => b.count - a.count);
}

function formatAnswerValue(answer) {
  if (answer == null || answer === '') return '—';
  if (Array.isArray(answer)) {
    const joined = answer
      .flat()
      .filter((part) => part != null && String(part).trim() !== '')
      .map((part) => String(part).trim())
      .join(', ');
    return joined || '—';
  }
  if (typeof answer === 'boolean') return answer ? 'Yes' : 'No';
  if (answer instanceof Date) return answer.toISOString().slice(0, 10);
  if (typeof answer === 'object') {
    if (answer.type === 'resume') {
      return answer.fileName || answer.url || 'Resume uploaded';
    }
    if (answer.type === 'applicantProfile') {
      return null;
    }
    if (answer.fileName || answer.url) {
      return answer.fileName || answer.url;
    }
    try {
      return JSON.stringify(answer);
    } catch {
      return '—';
    }
  }
  return String(answer);
}

function buildFormattedAnswers(application, form) {
  const questions = Array.isArray(form?.questions) ? form.questions : [];
  const questionById = new Map(questions.map((q) => [String(q._id), q]));
  const answers = Array.isArray(application?.answers) ? application.answers : [];

  return answers
    .map((entry, index) => {
      const raw = entry?.answer;
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        if (raw.type === 'applicantProfile' || raw.type === 'resume') {
          return null;
        }
      }

      const question = questionById.get(String(entry?.questionId));
      const displayValue = formatAnswerValue(raw);
      if (displayValue == null) return null;

      return {
        questionId: entry?.questionId || null,
        questionText: question?.questionText || `Question ${index + 1}`,
        questionType: question?.questionType || null,
        answer: raw,
        displayValue,
      };
    })
    .filter(Boolean);
}

function isProtectedAnswer(answer) {
  return (
    answer &&
    typeof answer === 'object' &&
    !Array.isArray(answer) &&
    (answer.type === 'applicantProfile' || answer.type === 'resume')
  );
}

function normalizeIncomingAnswers(answers) {
  if (answers == null) return null;
  if (!Array.isArray(answers)) {
    const err = new Error('answers must be an array.');
    err.status = 400;
    throw err;
  }

  return answers
    .filter(
      (entry) => entry && entry.questionId && mongoose.Types.ObjectId.isValid(entry.questionId),
    )
    .map((entry) => ({
      questionId: new mongoose.Types.ObjectId(entry.questionId),
      answer: entry.answer,
    }));
}

function mergeAnswers(existingAnswers, incomingAnswers) {
  const protectedEntries = (Array.isArray(existingAnswers) ? existingAnswers : []).filter((entry) =>
    isProtectedAnswer(entry?.answer),
  );
  return [...incomingAnswers, ...protectedEntries];
}

async function toApplicationDetail(application) {
  const form = application.formId
    ? await Form.findById(application.formId).select('title questions').lean()
    : null;

  return {
    _id: application._id,
    formId: application.formId,
    formTitle: form?.title || 'Untitled form',
    respondent: application.respondent || 'Anonymous',
    email: application.email || '',
    submittedAt: application.submittedAt,
    resumeUrl: application.resumeUrl || '',
    answers: buildFormattedAnswers(application, form),
  };
}

/**
 * GET /api/jobforms/applications
 * Paginated CRM list of live JobApplications across forms.
 */
exports.listJobApplications = async (req, res) => {
  try {
    const requestor = req.body?.requestor || req.user;
    if (!(await canManageJobForms(requestor))) {
      return res.status(403).json({ message: 'You are not authorized to view job applications.' });
    }

    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, DEFAULT_LIMIT), MAX_LIMIT);
    const skip = (page - 1) * limit;
    const match = buildListMatch(req.query);
    const sortDir = String(req.query.sort || '').toLowerCase() === 'asc' ? 1 : -1;

    const [total, rows] = await Promise.all([
      Response.countDocuments(match),
      Response.aggregate([
        { $match: match },
        { $sort: { submittedAt: sortDir } },
        { $skip: skip },
        { $limit: limit },
        {
          $lookup: {
            from: Form.collection.name,
            localField: 'formId',
            foreignField: '_id',
            as: 'form',
          },
        },
        {
          $project: {
            formId: 1,
            formTitle: { $ifNull: [{ $arrayElemAt: ['$form.title', 0] }, 'Untitled form'] },
            respondent: 1,
            email: 1,
            submittedAt: 1,
            resumeUrl: 1,
            answerCount: { $size: { $ifNull: ['$answers', []] } },
          },
        },
      ]),
    ]);

    return res.status(200).json({
      total,
      page,
      limit,
      items: rows,
    });
  } catch (error) {
    console.error('listJobApplications failed:', error);
    return res.status(500).json({ message: 'Error fetching job applications.' });
  }
};

/**
 * GET /api/jobforms/applications/:applicationId
 * Single application detail with formatted question/answer pairs for CRM popover.
 */
exports.getJobApplicationById = async (req, res) => {
  try {
    const requestor = req.body?.requestor || req.user;
    if (!(await canManageJobForms(requestor))) {
      return res.status(403).json({ message: 'You are not authorized to view job applications.' });
    }

    const { applicationId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(applicationId)) {
      return res.status(400).json({ message: 'Invalid application id.' });
    }

    const application = await Response.findById(applicationId).lean();
    if (!application) {
      return res.status(404).json({ message: 'Application not found.' });
    }

    return res.status(200).json(await toApplicationDetail(application));
  } catch (error) {
    console.error('getJobApplicationById failed:', error);
    return res.status(500).json({ message: 'Error fetching job application details.' });
  }
};

/**
 * POST /api/jobforms/applications
 * Owner/Admin manual create for CRM entry (no public rate/bot guards).
 */
exports.createJobApplication = async (req, res) => {
  try {
    const requestor = req.body?.requestor || req.user;
    if (!(await canManageJobForms(requestor))) {
      return res
        .status(403)
        .json({ message: 'You are not authorized to create job applications.' });
    }

    const formId = req.body?.formId;
    if (!formId || !mongoose.Types.ObjectId.isValid(formId)) {
      return res.status(400).json({ message: 'A valid formId is required.' });
    }

    const form = await Form.findById(formId).select('_id title').lean();
    if (!form) {
      return res.status(404).json({ message: 'Form not found.' });
    }

    const email = String(req.body?.email || '').trim();
    if (!email) {
      return res.status(400).json({ message: 'email is required.' });
    }

    let answers;
    try {
      answers = normalizeIncomingAnswers(req.body?.answers) || [];
    } catch (err) {
      return res.status(err.status || 400).json({ message: err.message });
    }

    const created = await Response.create({
      formId,
      respondent: String(req.body?.respondent || '').trim() || 'Anonymous',
      email,
      resumeUrl: String(req.body?.resumeUrl || '').trim(),
      answers,
      submittedAt: req.body?.submittedAt ? new Date(req.body.submittedAt) : new Date(),
    });

    return res.status(201).json(await toApplicationDetail(created.toObject()));
  } catch (error) {
    console.error('createJobApplication failed:', error);
    return res.status(500).json({ message: 'Error creating job application.' });
  }
};

/**
 * PUT /api/jobforms/applications/:applicationId
 * Owner/Admin update of applicant fields and/or answers.
 */
exports.updateJobApplication = async (req, res) => {
  try {
    const requestor = req.body?.requestor || req.user;
    if (!(await canManageJobForms(requestor))) {
      return res
        .status(403)
        .json({ message: 'You are not authorized to update job applications.' });
    }

    const { applicationId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(applicationId)) {
      return res.status(400).json({ message: 'Invalid application id.' });
    }

    const application = await Response.findById(applicationId);
    if (!application) {
      return res.status(404).json({ message: 'Application not found.' });
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'respondent')) {
      application.respondent = String(req.body.respondent || '').trim() || 'Anonymous';
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'email')) {
      const email = String(req.body.email || '').trim();
      if (!email) {
        return res.status(400).json({ message: 'email cannot be empty.' });
      }
      application.email = email;
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'resumeUrl')) {
      application.resumeUrl = String(req.body.resumeUrl || '').trim();
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'answers')) {
      let incoming;
      try {
        incoming = normalizeIncomingAnswers(req.body.answers);
      } catch (err) {
        return res.status(err.status || 400).json({ message: err.message });
      }
      application.answers = mergeAnswers(application.answers, incoming);
    }

    await application.save();
    return res.status(200).json(await toApplicationDetail(application.toObject()));
  } catch (error) {
    console.error('updateJobApplication failed:', error);
    return res.status(500).json({ message: 'Error updating job application.' });
  }
};

/**
 * DELETE /api/jobforms/applications/:applicationId
 * Owner/Admin hard-delete of a CRM application record.
 */
exports.deleteJobApplication = async (req, res) => {
  try {
    const requestor = req.body?.requestor || req.user;
    if (!(await canManageJobForms(requestor))) {
      return res
        .status(403)
        .json({ message: 'You are not authorized to delete job applications.' });
    }

    const { applicationId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(applicationId)) {
      return res.status(400).json({ message: 'Invalid application id.' });
    }

    const deleted = await Response.findByIdAndDelete(applicationId).lean();
    if (!deleted) {
      return res.status(404).json({ message: 'Application not found.' });
    }

    return res.status(200).json({ _id: deleted._id, deleted: true });
  } catch (error) {
    console.error('deleteJobApplication failed:', error);
    return res.status(500).json({ message: 'Error deleting job application.' });
  }
};

/**
 * GET /api/jobforms/applications/summary
 * Live CRM summary cards + deeper breakdowns from JobApplications + JobForms.
 */
exports.getJobApplicationsSummary = async (req, res) => {
  try {
    const requestor = req.body?.requestor || req.user;
    if (!(await canManageJobForms(requestor))) {
      return res.status(403).json({ message: 'You are not authorized to view job applications.' });
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      totalApplications,
      applicationsLast7Days,
      applicationsLast30Days,
      uniqueApplicantRows,
      activeForms,
      formsWithSubmissions,
      topForms,
      weekdayRows,
      hourRows,
      dailyTrendRows,
      hoursBucketRows,
      commitmentBucketRows,
      joiningExpectationRows,
    ] = await Promise.all([
      Response.countDocuments({}),
      Response.countDocuments({ submittedAt: { $gte: sevenDaysAgo } }),
      Response.countDocuments({ submittedAt: { $gte: thirtyDaysAgo } }),
      Response.aggregate([
        {
          $match: {
            email: { $exists: true, $nin: [null, ''] },
          },
        },
        {
          $group: {
            _id: { $toLower: '$email' },
          },
        },
        { $count: 'count' },
      ]),
      Form.countDocuments({ isActive: { $ne: false } }),
      Response.distinct('formId').then((ids) => ids.filter(Boolean).length),
      Response.aggregate([
        { $group: { _id: '$formId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: Form.collection.name,
            localField: '_id',
            foreignField: '_id',
            as: 'form',
          },
        },
        {
          $project: {
            formId: '$_id',
            formTitle: { $ifNull: [{ $arrayElemAt: ['$form.title', 0] }, 'Untitled form'] },
            count: 1,
            _id: 0,
          },
        },
      ]),
      Response.aggregate([
        { $match: { submittedAt: { $exists: true, $ne: null } } },
        { $group: { _id: { $dayOfWeek: '$submittedAt' }, count: { $sum: 1 } } },
      ]),
      Response.aggregate([
        { $match: { submittedAt: { $exists: true, $ne: null } } },
        { $group: { _id: { $hour: '$submittedAt' }, count: { $sum: 1 } } },
      ]),
      Response.aggregate([
        { $match: { submittedAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$submittedAt' },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            label: '$_id',
            count: 1,
            _id: 0,
          },
        },
      ]),
      Response.aggregate([
        { $unwind: '$answers' },
        { $match: { 'answers.answer.type': 'applicantProfile' } },
        {
          $project: {
            hours: {
              $convert: {
                input: '$answers.answer.hoursPerWeek',
                to: 'double',
                onError: null,
                onNull: null,
              },
            },
          },
        },
        { $match: { hours: { $ne: null } } },
        {
          $group: {
            _id: {
              $switch: {
                branches: [
                  { case: { $lt: ['$hours', 10] }, then: '< 10 hrs/week' },
                  { case: { $lt: ['$hours', 20] }, then: '10–19 hrs/week' },
                  { case: { $lt: ['$hours', 30] }, then: '20–29 hrs/week' },
                ],
                default: '30+ hrs/week',
              },
            },
            count: { $sum: 1 },
          },
        },
        { $project: { label: '$_id', count: 1, _id: 0 } },
        { $sort: { count: -1 } },
      ]),
      Response.aggregate([
        { $unwind: '$answers' },
        { $match: { 'answers.answer.type': 'applicantProfile' } },
        {
          $project: {
            months: {
              $convert: {
                input: '$answers.answer.monthsVolunteer',
                to: 'double',
                onError: null,
                onNull: null,
              },
            },
          },
        },
        { $match: { months: { $ne: null } } },
        {
          $group: {
            _id: {
              $switch: {
                branches: [
                  { case: { $lt: ['$months', 2] }, then: '< 2 months' },
                  { case: { $lt: ['$months', 3] }, then: '2–3 months' },
                  { case: { $lt: ['$months', 6] }, then: '3–6 months' },
                ],
                default: '6+ months',
              },
            },
            count: { $sum: 1 },
          },
        },
        { $project: { label: '$_id', count: 1, _id: 0 } },
        { $sort: { count: -1 } },
      ]),
      Response.aggregate([
        { $unwind: '$answers' },
        {
          $lookup: {
            from: Form.collection.name,
            localField: 'formId',
            foreignField: '_id',
            as: 'form',
          },
        },
        { $unwind: { path: '$form', preserveNullAndEmptyArrays: false } },
        {
          $addFields: {
            matchedQuestion: {
              $first: {
                $filter: {
                  input: { $ifNull: ['$form.questions', []] },
                  as: 'q',
                  cond: { $eq: ['$$q._id', '$answers.questionId'] },
                },
              },
            },
          },
        },
        {
          $match: {
            matchedQuestion: { $ne: null },
            $or: [
              { 'matchedQuestion.questionType': 'date' },
              {
                'matchedQuestion.questionText': {
                  $regex: 'start|join|available|begin|commence',
                  $options: 'i',
                },
              },
            ],
          },
        },
        {
          $project: {
            label: {
              $trim: {
                input: {
                  $cond: [
                    { $eq: [{ $type: '$answers.answer' }, 'date'] },
                    {
                      $dateToString: {
                        format: '%Y-%m-%d',
                        date: '$answers.answer',
                      },
                    },
                    { $toString: '$answers.answer' },
                  ],
                },
              },
            },
          },
        },
        {
          $match: {
            label: { $nin: [null, '', 'null', 'undefined'] },
          },
        },
        { $group: { _id: '$label', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
        { $project: { label: '$_id', count: 1, _id: 0 } },
      ]),
    ]);

    return res.status(200).json({
      totalApplications,
      applicationsLast7Days,
      applicationsLast30Days,
      uniqueApplicants: uniqueApplicantRows[0]?.count || 0,
      activeForms,
      formsWithSubmissions,
      topForms,
      applicationsByWeekday: fillWeekdayCounts(weekdayRows),
      applicationsByHour: fillHourCounts(hourRows),
      applicationsTrend30Days: dailyTrendRows,
      hoursPerWeekBreakdown: normalizeBucketRows(hoursBucketRows),
      commitmentBreakdown: normalizeBucketRows(commitmentBucketRows),
      joiningExpectations: normalizeBucketRows(joiningExpectationRows),
    });
  } catch (error) {
    console.error('getJobApplicationsSummary failed:', error);
    return res.status(500).json({ message: 'Error fetching job application summary.' });
  }
};

// Exported for unit tests
exports._test = {
  fillWeekdayCounts,
  fillHourCounts,
  bucketHours,
  bucketCommitment,
  normalizeBucketRows,
  formatAnswerValue,
  buildFormattedAnswers,
};
