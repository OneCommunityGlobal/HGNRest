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
      // Explicitly pick only schema-defined fields to prevent mass-assignment
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

      const issue = await buildingIssue.create({
        issueDate: safeIssueDate,
        createdBy,
        staffInvolved,
        issueTitle,
        issueText,
        imageUrl,
        projectId: safeProjectId,
        cost: safeCost,
        tag: VALID_TAGS[tagIdx],
        status: VALID_STATUSES[statusIdx],
        person,
      });
      res.status(201).json(issue);
    } catch (error) {
      res.status(500).json(error);
    }
  };

  // Update an existing issue
  const bmUpdateIssue = async (req, res) => {
    try {
      if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({ message: 'Invalid update data.' });
      }

      // Create a copy to avoid mutating req.body
      const updates = { ...req.body };

      // If closing an issue, set closedDate
      if (updates.status === 'closed') {
        updates.closedDate = new Date();
      }

      // If reopening a closed issue, clear closedDate
      if (updates.status === 'open') {
        updates.closedDate = null;
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
