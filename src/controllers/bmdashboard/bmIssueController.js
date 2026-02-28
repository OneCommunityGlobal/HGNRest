const { ObjectId } = require('mongoose').Types;
const { endOfDay } = require('date-fns');
const BuildingProject = require('../../models/bmdashboard/buildingProject');

const MS_PER_MINUTE = 60 * 1000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const AVG_DAYS_PER_MONTH = 30.44;
const MAX_LONGEST_OPEN_ISSUES = 7;

// Allowed values — arrays so the safe value comes from our list, breaking the taint chain
const VALID_TAGS = ['In-person', 'Virtual'];
const VALID_STATUSES = ['open', 'closed'];
// Mirrors the issueType enum used in the metIssue schema
const VALID_ISSUE_TYPES = ['Safety', 'Labor', 'Weather', 'Other', 'METs quality / functionality'];

// Max lengths from buildingIssue schema (breaks taint when building DB payload from user input)
const MAX_ISSUE_TITLE_LENGTH = 50;
const MAX_ISSUE_TEXT_LENGTH = 500;
const MAX_IMAGE_URL_LENGTH = 2048;
const MAX_PERSON_FIELD_LENGTH = 200;

/** Sanitize to an array of strings with each element capped at maxLen. Returns null if not an array or empty. */
const toSanitizedStringArray = (value, maxLen) => {
  if (!Array.isArray(value) || value.length === 0) return null;
  const out = value.filter((item) => item != null).map((item) => String(item).slice(0, maxLen));
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

const bmIssueController = function (buildingIssue) {
  // Fetch open issues with optional date range, project, and tag filtering
  const bmGetOpenIssue = async (req, res) => {
    try {
      const { projectIds, startDate, endDate, tag } = req.query;

      const query = {};

      // Filter by project IDs — only valid ObjectIds are accepted
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

      // Build date filter for "open during range"
      if (startDate || endDate) {
        if (startDate && endDate) {
          const start = new Date(startDate);
          const end = new Date(endDate);

          if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
            return res.status(400).json({ error: 'Invalid date format.' });
          }

          // Reject requests where startDate is after endDate
          if (start > end) {
            return res.status(400).json({
              error: 'startDate must not be after endDate.',
            });
          }

          const now = new Date();

          // Reject requests where the entire range is in the future —
          // no issue data can exist for dates that haven't occurred yet.
          if (start > now) {
            return res.status(400).json({
              error:
                'The selected date range is entirely in the future. No issue data exists for future dates.',
            });
          }

          // If endDate is in the future, cap it to the end of today so only
          // existing data is queried. req.query is not modified.
          const effectiveEnd = end > now ? endOfDay(now) : endOfDay(end);

          // Issue is "open during range" if:
          // 1. Created before or during the range (createdDate <= effectiveEnd)
          // 2. AND either still open OR closed on/after the range start
          query.$and = [
            { createdDate: { $lte: effectiveEnd } },
            { $or: buildOpenOrClosedAfter(start) },
          ];
        } else if (startDate) {
          const start = new Date(startDate);
          if (Number.isNaN(start.getTime())) {
            return res.status(400).json({ error: 'Invalid startDate format.' });
          }
          // Issues still open or closed on/after startDate
          query.$or = buildOpenOrClosedAfter(start);
        } else if (endDate) {
          const end = new Date(endDate);
          if (Number.isNaN(end.getTime())) {
            return res.status(400).json({ error: 'Invalid endDate format.' });
          }
          // All issues created on or before endDate
          query.createdDate = { $lte: endOfDay(end) };
        }
      } else {
        // No date filter: return only currently open issues
        query.status = 'open';
      }

      // Validate and apply tag filter — value assigned from our array, not from user input
      if (tag) {
        const tagIdx = VALID_TAGS.indexOf(typeof tag === 'string' ? tag : '');
        if (tagIdx === -1) {
          return res.status(400).json({
            error: `Invalid tag. Allowed values: ${VALID_TAGS.join(', ')}.`,
          });
        }
        query.tag = VALID_TAGS[tagIdx];
      }

      const results = await buildingIssue.find(query);
      return res.json(results || []);
    } catch (error) {
      console.error('Error fetching issues:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };

  // Fetch unique project IDs and their names from existing issues
  const getUniqueProjectIds = async (req, res) => {
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
      console.error('Error fetching unique project IDs:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };

  /* -------------------- POST ISSUE -------------------- */
  const bmPostIssue = async (req, res) => {
    try {
      // Explicitly pick only schema-defined fields; all values are validated/sanitized before DB (S5147)
      const {
        issueDate,
        createdBy,
        staffInvolved,
        issueTitle,
        issueText,
        imageUrl,
        projectId,
        cost,
        tag,
        status,
        person,
      } = req.body;

      // Validate enum fields — value assigned from our array, not from user input
      const tagIdx = VALID_TAGS.indexOf(typeof tag === 'string' ? tag : '');
      if (tagIdx === -1) {
        return res
          .status(400)
          .json({ error: `Invalid tag. Allowed values: ${VALID_TAGS.join(', ')}.` });
      }

      const statusIdx = VALID_STATUSES.indexOf(typeof status === 'string' ? status : '');
      if (statusIdx === -1) {
        return res
          .status(400)
          .json({ error: `Invalid status. Allowed values: ${VALID_STATUSES.join(', ')}.` });
      }

      // Convert typed fields — breaks taint chain via explicit type conversion
      const safeIssueDate = new Date(issueDate);
      if (Number.isNaN(safeIssueDate.getTime())) {
        return res.status(400).json({ error: 'Invalid issueDate.' });
      }

      if (!ObjectId.isValid(projectId)) {
        return res.status(400).json({ error: 'Invalid projectId.' });
      }
      const safeProjectId = new ObjectId(projectId);

      const safeCost = Number(cost);
      if (Number.isNaN(safeCost)) {
        return res.status(400).json({ error: 'Invalid cost.' });
      }

      // Validate createdBy (required)
      if (!ObjectId.isValid(createdBy)) {
        return res.status(400).json({ error: 'Invalid createdBy.' });
      }
      const safeCreatedBy = new ObjectId(createdBy);

      // Sanitize staffInvolved to array of ObjectIds only
      let safeStaffInvolved = [];
      if (staffInvolved != null && Array.isArray(staffInvolved)) {
        safeStaffInvolved = staffInvolved
          .filter((id) => ObjectId.isValid(id))
          .map((id) => new ObjectId(id));
      }

      // Sanitize string arrays (required) — do not pass raw user input to DB
      const safeIssueTitle = toSanitizedStringArray(issueTitle, MAX_ISSUE_TITLE_LENGTH);
      if (!safeIssueTitle) {
        return res.status(400).json({ error: 'Invalid issueTitle.' });
      }

      const safeIssueText = toSanitizedStringArray(issueText, MAX_ISSUE_TEXT_LENGTH);
      if (!safeIssueText) {
        return res.status(400).json({ error: 'Invalid issueText.' });
      }

      // Optional imageUrl — sanitized string array
      let safeImageUrl = [];
      if (imageUrl != null && Array.isArray(imageUrl)) {
        const urls = toSanitizedStringArray(imageUrl, MAX_IMAGE_URL_LENGTH);
        if (urls) safeImageUrl = urls;
      }

      // Optional person subdocument — only name and role as sanitized strings
      let safePerson;
      if (person != null && typeof person === 'object' && !Array.isArray(person)) {
        const name =
          person.name != null ? String(person.name).slice(0, MAX_PERSON_FIELD_LENGTH) : '';
        const role =
          person.role != null ? String(person.role).slice(0, MAX_PERSON_FIELD_LENGTH) : '';
        safePerson = { name, role };
      }

      // Build payload from validated/sanitized values only — no user-controlled data passed through
      const createPayload = {
        issueDate: safeIssueDate,
        createdBy: safeCreatedBy,
        staffInvolved: safeStaffInvolved,
        issueTitle: safeIssueTitle,
        issueText: safeIssueText,
        imageUrl: safeImageUrl,
        projectId: safeProjectId,
        cost: safeCost,
        tag: VALID_TAGS[tagIdx],
        status: VALID_STATUSES[statusIdx],
      };
      if (safePerson !== undefined) {
        createPayload.person = safePerson;
      }

      const issue = await buildingIssue.create(createPayload);
      res.status(201).json(issue);
    } catch (error) {
      res.status(500).json(error);
    }
  };

  // Update an existing issue — only whitelisted fields with sanitized values (S5147)
  const bmUpdateIssue = async (req, res) => {
    try {
      if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({ message: 'Invalid update data.' });
      }

      const { status, issueTitle, issueText, imageUrl, person } = req.body;
      const updates = {};

      // Status: only allow enum values; assign from our array
      if (status !== undefined) {
        const statusIdx = VALID_STATUSES.indexOf(typeof status === 'string' ? status : '');
        if (statusIdx === -1) {
          return res
            .status(400)
            .json({ error: `Invalid status. Allowed values: ${VALID_STATUSES.join(', ')}.` });
        }
        updates.status = VALID_STATUSES[statusIdx];
        if (updates.status === 'closed') {
          updates.closedDate = new Date();
        } else if (updates.status === 'open') {
          updates.closedDate = null;
        }
      }

      // Optional string-array and subdocument fields — sanitize before adding to $set
      if (issueTitle !== undefined) {
        const safe = toSanitizedStringArray(issueTitle, MAX_ISSUE_TITLE_LENGTH);
        if (!safe) {
          return res.status(400).json({ message: 'Invalid issueTitle.' });
        }
        updates.issueTitle = safe;
      }
      if (issueText !== undefined) {
        const safe = toSanitizedStringArray(issueText, MAX_ISSUE_TEXT_LENGTH);
        if (!safe) {
          return res.status(400).json({ message: 'Invalid issueText.' });
        }
        updates.issueText = safe;
      }
      if (imageUrl !== undefined) {
        if (Array.isArray(imageUrl)) {
          const urls = toSanitizedStringArray(imageUrl, MAX_IMAGE_URL_LENGTH);
          updates.imageUrl = urls || [];
        } else {
          updates.imageUrl = [];
        }
      }
      if (
        person !== undefined &&
        person != null &&
        typeof person === 'object' &&
        !Array.isArray(person)
      ) {
        const name =
          person.name != null ? String(person.name).slice(0, MAX_PERSON_FIELD_LENGTH) : '';
        const role =
          person.role != null ? String(person.role).slice(0, MAX_PERSON_FIELD_LENGTH) : '';
        updates.person = { name, role };
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: 'Invalid update data.' });
      }

      const updatedIssue = await buildingIssue.findByIdAndUpdate(
        req.params.id,
        { $set: updates },
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

  // Delete an issue by ID
  const bmDeleteIssue = async (req, res) => {
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

  /* -------------------- GET ALL ISSUES -------------------- */
  const bmGetIssue = async (req, res) => {
    try {
      const issues = await buildingIssue.find().populate();
      res.status(200).json(issues);
    } catch (error) {
      res.status(500).json(error);
    }
  };

  /* -------------------- ISSUE CHART (MULTI-YEAR) -------------------- */
  const bmGetIssueChart = async (req, res) => {
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
        if (Number.isNaN(yearInt) || yearInt < 1000 || yearInt > 9999) {
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

  /* -------------------- LONGEST OPEN ISSUES (FINAL) -------------------- */
  const getLongestOpenIssues = async (req, res) => {
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

  return {
    bmGetOpenIssue,
    bmUpdateIssue,
    bmDeleteIssue,
    getUniqueProjectIds,
    bmGetIssue,
    bmPostIssue,
    bmGetIssueChart,
    getLongestOpenIssues,
  };
};

module.exports = bmIssueController;
