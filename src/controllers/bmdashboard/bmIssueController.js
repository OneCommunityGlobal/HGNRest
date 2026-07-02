const { ObjectId } = require('mongoose').Types;
const { endOfDay } = require('date-fns');
const BuildingProject = require('../../models/bmdashboard/buildingProject');
const logger = require('../../startup/logger');

const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = SECONDS_PER_MINUTE * MS_PER_SECOND;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const AVG_DAYS_PER_MONTH = 30.44;
const MAX_LONGEST_OPEN_ISSUES = 7;

const VALID_TAGS = ['In-person', 'Virtual'];
const VALID_STATUSES = ['open', 'closed'];
const VALID_ISSUE_TYPES = ['Safety', 'Labor', 'Weather', 'Other', 'METs quality / functionality'];

const MIN_YEAR = 1000;
const MAX_YEAR = 9999;

const MAX_ISSUE_TITLE_LENGTH = 50;
const MAX_ISSUE_TEXT_LENGTH = 500;
const MAX_IMAGE_URL_LENGTH = 2048;
const MAX_PERSON_FIELD_LENGTH = 200;

const toSanitizedStringArray = (value, maxLen) => {
  if (!Array.isArray(value) || value.length === 0) return null;
  const out = value
    .filter((item) => item !== null && item !== undefined)
    .map((item) => String(item).slice(0, maxLen));
  return out.length > 0 ? out : null;
};

const buildOpenOrClosedAfter = (start) => [{ status: 'open' }, { closedDate: { $gte: start } }];

const getProjectFilterIds = (projectsParam) =>
  projectsParam ? projectsParam.split(',').map((id) => id.trim()) : [];

const filterProjectIdsByDates = async (datesParam, currentProjectIds) => {
  if (!datesParam) {
    return currentProjectIds;
  }

  const [start, end] = datesParam.split(',').map((d) => d.trim());
  const matchingProjects = await BuildingProject.find({
    dateCreated: { $gte: new Date(start), $lte: new Date(end) },
    isActive: true,
  })
    .select('_id')
    .lean();

  const dateIds = matchingProjects.map((p) => p._id.toString());
  if (currentProjectIds.length === 0) {
    return dateIds;
  }

  return currentProjectIds.filter((id) => dateIds.includes(id));
};

const getDurationOpenMonths = (issueDate) =>
  Math.ceil(
    (Date.now() - new Date(issueDate)) /
      (MS_PER_MINUTE * MINUTES_PER_HOUR * HOURS_PER_DAY * AVG_DAYS_PER_MONTH),
  );

const buildGroupedIssues = (issues) => {
  const grouped = {};

  issues.forEach((issue) => {
    if (!issue.issueDate || !issue.projectId) return;

    const issueName = Array.isArray(issue.issueTitle)
      ? issue.issueTitle[0]
      : issue.issueTitle || 'Unknown Issue';

    const projectId = issue.projectId._id.toString();
    const projectName = issue.projectId.projectName || issue.projectId.name || 'Unknown Project';

    const durationOpen = getDurationOpenMonths(issue.issueDate);

    if (!grouped[issueName]) grouped[issueName] = {};
    if (!grouped[issueName][projectId]) {
      grouped[issueName][projectId] = {
        projectId,
        projectName,
        durationOpen,
      };
    }
  });

  return grouped;
};

const buildLongestOpenResponse = (grouped) =>
  Object.entries(grouped)
    .map(([issueName, projectsById]) => ({
      issueName,
      projects: Object.values(projectsById),
    }))
    .slice(0, MAX_LONGEST_OPEN_ISSUES);

const omitUndefined = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined));

const buildInjuryIssuePayload = (body = {}) =>
  omitUndefined({
    projectId: body.projectId,
    name: body.name,
    openDate: body.openDate,
    category: body.category,
    assignedTo: body.assignedTo,
    totalCost: body.totalCost,
  });

const buildBuildingIssuePayload = (body = {}) => ({
  createdDate: body.createdDate,
  issueDate: body.issueDate,
  createdBy: body.createdBy,
  staffInvolved: body.staffInvolved,
  issueTitle: body.issueTitle,
  issueText: body.issueText,
  issueType: body.issueType,
  imageUrl: body.imageUrl,
  projectId: body.projectId,
  status: body.status,
  tag: body.tag,
});

function parseDateRangeForOpenIssues(startDate, endDate) {
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime())) {
      return { errorResponse: { status: 400, body: { error: 'Invalid date format.' } } };
    }
    if (Number.isNaN(end.getTime())) {
      return { errorResponse: { status: 400, body: { error: 'Invalid date format.' } } };
    }
    if (start > end) {
      return {
        errorResponse: { status: 400, body: { error: 'startDate must not be after endDate.' } },
      };
    }
    const now = new Date();
    if (start > now) {
      return {
        errorResponse: {
          status: 400,
          body: {
            error:
              'The selected date range is entirely in the future. No issue data exists for future dates.',
          },
        },
      };
    }
    const effectiveEnd = end > now ? endOfDay(now) : endOfDay(end);
    return {
      queryPart: {
        $and: [{ createdDate: { $lte: effectiveEnd } }, { $or: buildOpenOrClosedAfter(start) }],
      },
    };
  }
  if (startDate) {
    const start = new Date(startDate);
    if (Number.isNaN(start.getTime())) {
      return { errorResponse: { status: 400, body: { error: 'Invalid date format.' } } };
    }
    return { queryPart: { $or: buildOpenOrClosedAfter(start) } };
  }
  if (endDate) {
    const end = new Date(endDate);
    if (Number.isNaN(end.getTime())) {
      return { errorResponse: { status: 400, body: { error: 'Invalid date format.' } } };
    }
    return { queryPart: { createdDate: { $lte: endOfDay(end) } } };
  }
  return null;
}

function validateTagForQuery(tag) {
  const tagIdx = VALID_TAGS.indexOf(typeof tag === 'string' ? tag : '');
  if (tagIdx === -1) {
    return {
      errorResponse: {
        status: 400,
        body: { error: `Invalid tag. Allowed values: ${VALID_TAGS.join(', ')}.` },
      },
    };
  }
  return { tag: VALID_TAGS[tagIdx] };
}

function buildOpenIssuesQuery({ projectIds, startDate, endDate, tag }) {
  const query = {};

  if (projectIds) {
    const validProjectIds = projectIds
      .split(',')
      .map((id) => id.trim())
      .filter((id) => ObjectId.isValid(id))
      .map((id) => new ObjectId(id));
    if (validProjectIds.length > 0) {
      query.projectId = { $in: validProjectIds };
    }
  }

  if (startDate || endDate) {
    const dateResult = parseDateRangeForOpenIssues(startDate, endDate);
    if (dateResult?.errorResponse) {
      return dateResult;
    }
    if (dateResult && dateResult.queryPart) {
      Object.assign(query, dateResult.queryPart);
    }
  } else {
    query.status = 'open';
  }

  if (tag) {
    const tagResult = validateTagForQuery(tag);
    if (tagResult.errorResponse) {
      return tagResult;
    }
    query.tag = tagResult.tag;
  }

  return { query };
}

function validatePostBody(body) {
  if (body.tag !== undefined) {
    const tagIdx = VALID_TAGS.indexOf(typeof body.tag === 'string' ? body.tag : '');
    if (tagIdx === -1) {
      return { error: `Invalid tag. Allowed values: ${VALID_TAGS.join(', ')}.` };
    }
  }
  if (body.status !== undefined) {
    const statusIdx = VALID_STATUSES.indexOf(typeof body.status === 'string' ? body.status : '');
    if (statusIdx === -1) {
      return { error: `Invalid status. Allowed values: ${VALID_STATUSES.join(', ')}.` };
    }
  }
  if (body.issueDate !== undefined) {
    const d = new Date(body.issueDate);
    if (Number.isNaN(d.getTime())) {
      return { error: 'Invalid issueDate.' };
    }
  }
  if (body.projectId !== undefined) {
    if (!ObjectId.isValid(body.projectId)) {
      return { error: 'Invalid projectId.' };
    }
  }
  if (body.cost !== undefined) {
    const cost = Number(body.cost);
    if (Number.isNaN(cost)) {
      return { error: 'Invalid cost.' };
    }
  }
  return null;
}

const bmIssueController = function (BuildingIssue, injuryIssue) {
  /* -------------------- GET ALL ISSUES -------------------- */
  const bmGetIssue = async (req, res) => {
    try {
      const issues = await BuildingIssue.find().populate();
      res.status(200).json(issues);
    } catch (error) {
      res.status(500).json(error);
    }
  };

  /* -------------------- GET OPEN ISSUES -------------------- */
  const bmGetOpenIssue = async (req, res) => {
    try {
      const built = buildOpenIssuesQuery(req.query);
      if (built.errorResponse) {
        return res.status(built.errorResponse.status).json(built.errorResponse.body);
      }
      const results = await BuildingIssue.find(built.query);
      return res.json(results || []);
    } catch (error) {
      logger.logException(error, { context: 'bmGetOpenIssue' });
      return res.status(500).json({ error: 'Internal server error' });
    }
  };

  /* -------------------- GET UNIQUE PROJECT IDS -------------------- */
  const getUniqueProjectIds = async (req, res) => {
    try {
      const results = await BuildingIssue.aggregate([
        { $group: { _id: '$projectId' } },
        {
          $lookup: {
            from: 'buildingProjects',
            localField: '_id',
            foreignField: '_id',
            as: 'projectDetails',
          },
        },
        {
          $project: {
            _id: 1,
            projectName: { $arrayElemAt: ['$projectDetails.name', 0] },
          },
        },
        { $sort: { projectName: 1 } },
      ]);

      const formattedResults = results.map((item) => ({
        projectId: item._id,
        projectName: item.projectName || 'Unknown Project',
      }));

      return res.json(formattedResults);
    } catch (error) {
      logger.logException(error, { context: 'getUniqueProjectIds' });
      return res.status(500).json({ error: 'Internal server error' });
    }
  };

  /* -------------------- POST ISSUE -------------------- */
  const bmPostIssue = async (req, res) => {
    try {
      const validationError = validatePostBody(req.body);
      if (validationError) {
        return res.status(400).json(validationError);
      }
      const issuePayload = buildBuildingIssuePayload(req.body);
      const issue = await BuildingIssue.create(issuePayload);
      return res.status(201).json(issue);
    } catch (error) {
      return res.status(500).json(error);
    }
  };

  /* -------------------- UPDATE ISSUE -------------------- */
  const bmUpdateIssue = async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!updateData || typeof updateData !== 'object' || Array.isArray(updateData)) {
        return res.status(400).json({ message: 'Invalid update data.' });
      }

      const setFields = { ...updateData };
      if (setFields.status === 'closed') {
        setFields.closedDate = new Date();
      } else if (setFields.status === 'open') {
        setFields.closedDate = null;
      }

      const updated = await BuildingIssue.findByIdAndUpdate(id, { $set: setFields }, { new: true });

      if (!updated) {
        return res.status(404).json({ message: 'Issue not found.' });
      }

      return res.json(updated);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  };

  /* -------------------- DELETE ISSUE -------------------- */
  const bmDeleteIssue = async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await BuildingIssue.findByIdAndDelete(id);
      if (!deleted) {
        return res.status(404).json({ message: 'Issue not found.' });
      }
      return res.json({ message: 'Issue deleted successfully.' });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  };

  /* -------------------- ISSUE CHART -------------------- */
  const bmGetIssueChart = async (req, res) => {
    try {
      const { issueType, year } = req.query;

      const match = {};

      if (issueType !== undefined) {
        if (typeof issueType !== 'string' || !VALID_ISSUE_TYPES.includes(issueType)) {
          return res.status(400).json({
            error: `Invalid issueType. Allowed values: ${VALID_ISSUE_TYPES.join(', ')}.`,
          });
        }
        match.issueType = issueType;
      }

      if (year !== undefined) {
        const yearNum = Number(year);
        if (
          Number.isNaN(yearNum) ||
          !Number.isInteger(yearNum) ||
          yearNum < MIN_YEAR ||
          yearNum > MAX_YEAR
        ) {
          return res.status(400).json({ error: 'Invalid year. Must be a 4-digit integer.' });
        }
        const startOfYear = new Date(Date.UTC(yearNum, 0, 1));
        const endOfYear = new Date(Date.UTC(yearNum, 11, 31, 23, 59, 59, 999));
        match.issueDate = { $gte: startOfYear, $lte: endOfYear };
      }

      const pipeline = [
        { $match: match },
        {
          $group: {
            _id: '$issueType',
            years: {
              $push: {
                year: { $year: '$issueDate' },
                count: 1,
              },
            },
          },
        },
      ];

      const results = await BuildingIssue.aggregate(pipeline);

      const formatted = {};
      results.forEach((item) => {
        formatted[item._id] = {};
        item.years.forEach(({ year: y, count }) => {
          formatted[item._id][y] = (formatted[item._id][y] || 0) + count;
        });
      });

      return res.status(200).json(formatted);
    } catch (error) {
      return res.status(500).json({ message: 'Server error', error });
    }
  };

  /* -------------------- INJURY ISSUES -------------------- */
  const bmPostInjuryIssue = async (req, res) => {
    try {
      const issuePayload = buildInjuryIssuePayload(req.body);
      const issue = await injuryIssue.create(issuePayload);
      return res.status(201).json(issue);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  };

  const bmGetInjuryIssue = async (req, res) => {
    try {
      const issues = await injuryIssue.find().populate('assignedTo', 'firstName lastName _id');
      return res.status(200).json(issues);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  };

  const bmDeleteInjuryIssue = async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await injuryIssue.findByIdAndDelete(id);
      if (!deleted) {
        return res.status(404).json({ message: 'Issue not found' });
      }
      return res.status(200).json({ message: 'Deleted successfully', deleted });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  };

  const bmRenameInjuryIssue = async (req, res) => {
    try {
      const { id } = req.params;
      const { newName } = req.body;
      if (!newName) {
        return res.status(400).json({ message: 'newName is required' });
      }
      const updated = await injuryIssue.findByIdAndUpdate(
        id,
        { name: newName },
        { new: true, runValidators: true },
      );
      if (!updated) {
        return res.status(404).json({ message: 'Issue not found' });
      }
      return res.status(200).json({ message: 'Renamed successfully', updated });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  };

  const bmCopyInjuryIssue = async (req, res) => {
    try {
      const { id } = req.params;
      const original = await injuryIssue.findById(id).lean();
      if (!original) {
        return res.status(404).json({ message: 'Issue not found' });
      }

      const copyData = {
        projectId: original.projectId,
        name: `${original.name} (Copy)`,
        openDate: Date.now(),
        category: original.category,
        assignedTo: original.assignedTo,
        totalCost: original.totalCost,
      };

      const copy = await injuryIssue.create(copyData);
      return res.status(201).json({ message: 'Copied successfully', copy });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  };

  /* -------------------- LONGEST OPEN ISSUES -------------------- */
  const getLongestOpenIssues = async (req, res) => {
    try {
      const { dates, projects } = req.query;
      const query = { status: 'open' };
      let filteredProjectIds = getProjectFilterIds(projects);

      filteredProjectIds = await filterProjectIdsByDates(dates, filteredProjectIds);

      if (dates && filteredProjectIds.length === 0) {
        return res.json([]);
      }

      if (filteredProjectIds.length) {
        query.projectId = { $in: filteredProjectIds };
      }

      const issues = await BuildingIssue.find(query)
        .select('issueTitle issueDate _id')
        .populate('projectId')
        .lean();

      const grouped = buildGroupedIssues(issues);
      const response = buildLongestOpenResponse(grouped);

      res.json(response);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching longest open issues' });
    }
  };

  return {
    bmGetIssue,
    bmGetOpenIssue,
    bmPostIssue,
    bmUpdateIssue,
    bmDeleteIssue,
    bmGetIssueChart,
    getLongestOpenIssues,
    getUniqueProjectIds,
    bmPostInjuryIssue,
    bmGetInjuryIssue,
    bmDeleteInjuryIssue,
    bmRenameInjuryIssue,
    bmCopyInjuryIssue,
  };
};

module.exports = bmIssueController;
