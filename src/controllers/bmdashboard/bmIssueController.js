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

// Allowed values — arrays so the safe value comes from our list, breaking the taint chain
const VALID_TAGS = ['In-person', 'Virtual'];
const VALID_STATUSES = ['open', 'closed'];
// Mirrors the issueType enum used in the metIssue schema
const VALID_ISSUE_TYPES = ['Safety', 'Labor', 'Weather', 'Other', 'METs quality / functionality'];

const MIN_YEAR = 1000;
const MAX_YEAR = 9999;

// Max lengths from buildingIssue schema (breaks taint when building DB payload from user input)
const MAX_ISSUE_TITLE_LENGTH = 50;
const MAX_ISSUE_TEXT_LENGTH = 500;
const MAX_IMAGE_URL_LENGTH = 2048;
const MAX_PERSON_FIELD_LENGTH = 200;

/** Sanitize to an array of strings with each element capped at maxLen. Returns null if not an array or empty. */
const toSanitizedStringArray = (value, maxLen) => {
  if (!Array.isArray(value) || value.length === 0) return null;
  const out = value
    .filter((item) => item !== null && item !== undefined)
    .map((item) => String(item).slice(0, maxLen));
  return out.length > 0 ? out : null;
};

// Reusable condition: issue is open or was closed on/after `start`
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

/** Returns { errorResponse } or { queryPart } to merge into open-issues query. */
function parseDateRangeForOpenIssues(startDate, endDate) {
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
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
      return { errorResponse: { status: 400, body: { error: 'Invalid startDate format.' } } };
    }
    return { queryPart: { $or: buildOpenOrClosedAfter(start) } };
  }
  if (endDate) {
    const end = new Date(endDate);
    if (Number.isNaN(end.getTime())) {
      return { errorResponse: { status: 400, body: { error: 'Invalid endDate format.' } } };
    }
    return { queryPart: { createdDate: { $lte: endOfDay(end) } } };
  }
  return null;
}

/** Returns { errorResponse } or { tag }. */
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
    if (dateResult && dateResult?.errorResponse) {
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

const createBmGetOpenIssue = (buildingIssue) => async (req, res) => {
  try {
    const built = buildOpenIssuesQuery(req.query);
    if (built.errorResponse) {
      return res.status(built.errorResponse.status).json(built.errorResponse.body);
    }
    const results = await buildingIssue.find(built.query);
    return res.json(results || []);
  } catch (error) {
    logger.logException(error, { context: 'bmGetOpenIssue' });
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const createGetUniqueProjectIds = (buildingIssue) => async (req, res) => {
  try {
    const results = await buildingIssue.aggregate([
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

/** Returns { errorResponse } or { tagIdx, statusIdx }. */
function validatePostEnums(body) {
  const tagIdx = VALID_TAGS.indexOf(typeof body.tag === 'string' ? body.tag : '');
  if (tagIdx === -1) {
    return {
      errorResponse: {
        status: 400,
        body: { error: `Invalid tag. Allowed values: ${VALID_TAGS.join(', ')}.` },
      },
    };
  }
  const statusIdx = VALID_STATUSES.indexOf(typeof body.status === 'string' ? body.status : '');
  if (statusIdx === -1) {
    return {
      errorResponse: {
        status: 400,
        body: { error: `Invalid status. Allowed values: ${VALID_STATUSES.join(', ')}.` },
      },
    };
  }
  return { tagIdx, statusIdx };
}

/** Returns { errorResponse } or { safeIssueDate, safeProjectId, safeCost, safeCreatedBy }. */
function validatePostDatesAndIds(body) {
  const safeIssueDate = new Date(body.issueDate);
  if (Number.isNaN(safeIssueDate.getTime())) {
    return { errorResponse: { status: 400, body: { error: 'Invalid issueDate.' } } };
  }
  if (!ObjectId.isValid(body.projectId)) {
    return { errorResponse: { status: 400, body: { error: 'Invalid projectId.' } } };
  }
  const safeCost = Number(body.cost);
  if (Number.isNaN(safeCost)) {
    return { errorResponse: { status: 400, body: { error: 'Invalid cost.' } } };
  }
  if (!ObjectId.isValid(body.createdBy)) {
    return { errorResponse: { status: 400, body: { error: 'Invalid createdBy.' } } };
  }
  return {
    safeIssueDate,
    safeProjectId: new ObjectId(body.projectId),
    safeCost,
    safeCreatedBy: new ObjectId(body.createdBy),
  };
}

/** Returns { errorResponse } or { safeIssueTitle, safeIssueText, safeImageUrl }. */
function validatePostStringArrays(body) {
  const safeIssueTitle = toSanitizedStringArray(body.issueTitle, MAX_ISSUE_TITLE_LENGTH);
  if (!safeIssueTitle) {
    return { errorResponse: { status: 400, body: { error: 'Invalid issueTitle.' } } };
  }
  const safeIssueText = toSanitizedStringArray(body.issueText, MAX_ISSUE_TEXT_LENGTH);
  if (!safeIssueText) {
    return { errorResponse: { status: 400, body: { error: 'Invalid issueText.' } } };
  }
  let safeImageUrl = [];
  if (body.imageUrl !== null && body.imageUrl !== undefined && Array.isArray(body.imageUrl)) {
    const urls = toSanitizedStringArray(body.imageUrl, MAX_IMAGE_URL_LENGTH);
    if (urls) safeImageUrl = urls;
  }
  return { safeIssueTitle, safeIssueText, safeImageUrl };
}

/** Returns sanitized staffInvolved array and optional person subdocument. */
function sanitizePostStaffAndPerson(body) {
  let safeStaffInvolved = [];
  if (
    body.staffInvolved !== null &&
    body.staffInvolved !== undefined &&
    Array.isArray(body.staffInvolved)
  ) {
    safeStaffInvolved = body.staffInvolved
      .filter((id) => ObjectId.isValid(id))
      .map((id) => new ObjectId(id));
  }
  let safePerson;
  const { person } = body;
  if (
    person !== null &&
    person !== undefined &&
    typeof person === 'object' &&
    !Array.isArray(person)
  ) {
    const name =
      person.name !== null && person.name !== undefined
        ? String(person.name).slice(0, MAX_PERSON_FIELD_LENGTH)
        : '';
    const role =
      person.role !== null && person.role !== undefined
        ? String(person.role).slice(0, MAX_PERSON_FIELD_LENGTH)
        : '';
    safePerson = { name, role };
  }
  return { safeStaffInvolved, safePerson };
}

function validateAndBuildPostPayload(body) {
  const enumResult = validatePostEnums(body);
  if (enumResult.errorResponse) return enumResult;

  const datesResult = validatePostDatesAndIds(body);
  if (datesResult.errorResponse) return datesResult;

  const arraysResult = validatePostStringArrays(body);
  if (arraysResult.errorResponse) return arraysResult;

  const { safeStaffInvolved, safePerson } = sanitizePostStaffAndPerson(body);

  const payload = {
    issueDate: datesResult.safeIssueDate,
    createdBy: datesResult.safeCreatedBy,
    staffInvolved: safeStaffInvolved,
    issueTitle: arraysResult.safeIssueTitle,
    issueText: arraysResult.safeIssueText,
    imageUrl: arraysResult.safeImageUrl,
    projectId: datesResult.safeProjectId,
    cost: datesResult.safeCost,
    tag: VALID_TAGS[enumResult.tagIdx],
    status: VALID_STATUSES[enumResult.statusIdx],
  };
  if (safePerson !== undefined) {
    payload.person = safePerson;
  }
  return { payload };
}

const createBmPostIssue = (buildingIssue) => async (req, res) => {
  try {
    const result = validateAndBuildPostPayload(req.body);
    if (result.errorResponse) {
      return res.status(result.errorResponse.status).json(result.errorResponse.body);
    }
    const issue = await buildingIssue.create(result.payload);
    res.status(201).json(issue);
  } catch (error) {
    res.status(500).json(error);
  }
};

/** Returns { errorResponse } or applies status + closedDate to updates. */
function applyStatusToUpdates(updates, status) {
  if (status === undefined) return null;
  const statusIdx = VALID_STATUSES.indexOf(typeof status === 'string' ? status : '');
  if (statusIdx === -1) {
    return {
      errorResponse: {
        status: 400,
        body: { error: `Invalid status. Allowed values: ${VALID_STATUSES.join(', ')}.` },
      },
    };
  }
  updates.status = VALID_STATUSES[statusIdx];
  if (updates.status === 'closed') {
    updates.closedDate = new Date();
  } else if (updates.status === 'open') {
    updates.closedDate = null;
  }
  return null;
}

/** Returns sanitized { name, role } or null if person is not a valid subdocument. */
function sanitizePersonSubdocument(person) {
  if (
    person === undefined ||
    person === null ||
    typeof person !== 'object' ||
    Array.isArray(person)
  ) {
    return null;
  }
  const name =
    person.name !== null && person.name !== undefined
      ? String(person.name).slice(0, MAX_PERSON_FIELD_LENGTH)
      : '';
  const role =
    person.role !== null && person.role !== undefined
      ? String(person.role).slice(0, MAX_PERSON_FIELD_LENGTH)
      : '';
  return { name, role };
}

/** Returns { errorResponse } or null; may add issueTitle, issueText, imageUrl, person to updates. */
function applyOptionalUpdateFields(updates, body) {
  const { issueTitle, issueText, imageUrl, person } = body;

  if (issueTitle !== undefined) {
    const safe = toSanitizedStringArray(issueTitle, MAX_ISSUE_TITLE_LENGTH);
    if (!safe) {
      return { errorResponse: { status: 400, body: { message: 'Invalid issueTitle.' } } };
    }
    updates.issueTitle = safe;
  }
  if (issueText !== undefined) {
    const safe = toSanitizedStringArray(issueText, MAX_ISSUE_TEXT_LENGTH);
    if (!safe) {
      return { errorResponse: { status: 400, body: { message: 'Invalid issueText.' } } };
    }
    updates.issueText = safe;
  }
  if (imageUrl !== undefined) {
    updates.imageUrl = Array.isArray(imageUrl)
      ? toSanitizedStringArray(imageUrl, MAX_IMAGE_URL_LENGTH) || []
      : [];
  }
  const safePerson = sanitizePersonSubdocument(person);
  if (safePerson !== null) {
    updates.person = safePerson;
  }
  return null;
}

function validateAndBuildUpdatePayload(body) {
  if (!body || typeof body !== 'object') {
    return { errorResponse: { status: 400, body: { message: 'Invalid update data.' } } };
  }
  const updates = {};

  const statusError = applyStatusToUpdates(updates, body.status);
  if (statusError) return statusError;

  const optionalError = applyOptionalUpdateFields(updates, body);
  if (optionalError) return optionalError;

  if (Object.keys(updates).length === 0) {
    return { errorResponse: { status: 400, body: { message: 'Invalid update data.' } } };
  }
  return { updates };
}

const createBmUpdateIssue = (buildingIssue) => async (req, res) => {
  try {
    const result = validateAndBuildUpdatePayload(req.body);
    if (result.errorResponse) {
      return res.status(result.errorResponse.status).json(result.errorResponse.body);
    }
    const updatedIssue = await buildingIssue.findByIdAndUpdate(
      req.params.id,
      { $set: result.updates },
      { new: true },
    );
    if (!updatedIssue) {
      return res.status(404).json({ message: 'Issue not found.' });
    }
    return res.json(updatedIssue);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const createBmDeleteIssue = (buildingIssue) => async (req, res) => {
  try {
    const { id } = req.params;
    const deletedIssue = await buildingIssue.findByIdAndDelete(id);
    if (!deletedIssue) {
      return res.status(404).json({ message: 'Issue not found.' });
    }
    return res.json({ message: 'Issue deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const createBmGetIssue = (buildingIssue) => async (req, res) => {
  try {
    const issues = await buildingIssue.find().populate();
    res.status(200).json(issues);
  } catch (error) {
    res.status(500).json(error);
  }
};

const createBmGetIssueChart = (buildingIssue) => async (req, res) => {
  try {
    const { issueType, year } = req.query;
    const matchQuery = {};

    if (issueType) {
      const issueTypeIdx = VALID_ISSUE_TYPES.indexOf(
        typeof issueType === 'string' ? issueType : '',
      );
      if (issueTypeIdx === -1) {
        return res.status(400).json({
          error: `Invalid issueType. Allowed values: ${VALID_ISSUE_TYPES.join(', ')}.`,
        });
      }
      matchQuery.issueType = VALID_ISSUE_TYPES[issueTypeIdx];
    }

    if (year) {
      const yearInt = Number.parseInt(year, 10);
      if (Number.isNaN(yearInt) || yearInt < MIN_YEAR || yearInt > MAX_YEAR) {
        return res.status(400).json({ error: 'Invalid year. Must be a 4-digit integer.' });
      }
      matchQuery.issueDate = {
        $gte: new Date(`${yearInt}-01-01T00:00:00Z`),
        $lte: new Date(`${yearInt}-12-31T23:59:59Z`),
      };
    }

    const pipeline = [
      { $match: matchQuery },
      {
        $group: {
          _id: {
            issueType: '$issueType',
            year: { $year: '$issueDate' },
          },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: '$_id.issueType',
          years: {
            $push: {
              year: '$_id.year',
              count: '$count',
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ];

    const data = await buildingIssue.aggregate(pipeline);

    const result = data.reduce((acc, item) => {
      acc[item._id] = {};
      item.years.forEach((y) => {
        acc[item._id][y.year] = y.count;
      });
      return acc;
    }, {});

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

const createGetLongestOpenIssues = (buildingIssue) => async (req, res) => {
  try {
    const { dates, projects } = req.query;
    const query = { status: 'open' };
    let filteredProjectIds = getProjectFilterIds(projects);

    /* ---- date filter ---- */
    filteredProjectIds = await filterProjectIdsByDates(dates, filteredProjectIds);

    if (dates && filteredProjectIds.length === 0) {
      return res.json([]);
    }

    if (filteredProjectIds.length) {
      query.projectId = { $in: filteredProjectIds };
    }

    /* ---- fetch issues ---- */
    const issues = await buildingIssue
      .find(query)
      .select('issueTitle issueDate projectId')
      .populate({
        path: 'projectId',
        select: 'projectName name',
      })
      .lean();

    /* ---- group by issue + project ---- */
    const grouped = buildGroupedIssues(issues);
    const response = buildLongestOpenResponse(grouped);

    res.json(response);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching longest open issues' });
  }
};

const bmIssueController = function (buildingIssue) {
  return {
    bmGetOpenIssue: createBmGetOpenIssue(buildingIssue),
    bmUpdateIssue: createBmUpdateIssue(buildingIssue),
    bmDeleteIssue: createBmDeleteIssue(buildingIssue),
    getUniqueProjectIds: createGetUniqueProjectIds(buildingIssue),
    bmGetIssue: createBmGetIssue(buildingIssue),
    bmPostIssue: createBmPostIssue(buildingIssue),
    bmGetIssueChart: createBmGetIssueChart(buildingIssue),
    getLongestOpenIssues: createGetLongestOpenIssues(buildingIssue),
  };
};

module.exports = bmIssueController;
