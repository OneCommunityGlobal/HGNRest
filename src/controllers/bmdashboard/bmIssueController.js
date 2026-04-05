const mongoose = require('mongoose');
const BuildingProject = require('../../models/bmdashboard/buildingProject');

const MS_PER_MINUTE = 60 * 1000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const AVG_DAYS_PER_MONTH = 30.44;
const MAX_LONGEST_OPEN_ISSUES = 7;

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

const bmIssueController = function (BuildingIssue) {
  /* -------------------- GET ALL ISSUES -------------------- */
  const bmGetIssue = async (req, res) => {
    try {
      const issues = await BuildingIssue.find().populate();
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

      if (issueType) matchQuery.issueType = issueType;

      if (year) {
        matchQuery.issueDate = {
          $gte: new Date(`${year}-01-01T00:00:00Z`),
          $lte: new Date(`${year}-12-31T23:59:59Z`),
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

      const data = await mongoose.model('buildingIssue').aggregate(pipeline);

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

  /* -------------------- POST ISSUE -------------------- */
  const bmPostIssue = async (req, res) => {
    try {
      const issue = await BuildingIssue.create(req.body);
      res.status(201).json(issue);
    } catch (error) {
      res.status(500).json(error);
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
      const issues = await BuildingIssue.find(query)
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
    bmGetIssue,
    bmPostIssue,
    bmGetIssueChart,
    getLongestOpenIssues,
  };
};

module.exports = bmIssueController;
