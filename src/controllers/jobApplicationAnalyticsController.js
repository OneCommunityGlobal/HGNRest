const mongoose = require('mongoose');
const Response = require('../models/jobApplicationsModel');
const Form = require('../models/JobFormsModel');
const { canManageJobForms } = require('../utilities/jobFormPermissions');

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 25;

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
 * GET /api/jobforms/applications/summary
 * Live CRM summary cards from JobApplications + JobForms.
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
    ]);

    return res.status(200).json({
      totalApplications,
      applicationsLast7Days,
      applicationsLast30Days,
      uniqueApplicants: uniqueApplicantRows[0]?.count || 0,
      activeForms,
      formsWithSubmissions,
      topForms,
    });
  } catch (error) {
    console.error('getJobApplicationsSummary failed:', error);
    return res.status(500).json({ message: 'Error fetching job application summary.' });
  }
};
