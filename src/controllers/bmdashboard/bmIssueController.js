const mongoose = require('mongoose');
const BuildingProject = require('../../models/bmdashboard/buildingProject');

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

      const data = await mongoose
        .model('buildingIssue')
        .aggregate(pipeline);

      const result = data.reduce((acc, item) => {
        acc[item._id] = {};
        item.years.forEach(y => {
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
      let filteredProjectIds = [];

      /* ---- project filter ---- */
      if (projects) {
        filteredProjectIds = projects.split(',').map(id => id.trim());
      }

      /* ---- date filter ---- */
      if (dates) {
        const [start, end] = dates.split(',').map(d => d.trim());

        const matchingProjects = await BuildingProject.find({
          dateCreated: { $gte: new Date(start), $lte: new Date(end) },
          isActive: true,
        })
          .select('_id')
          .lean();

        const dateIds = matchingProjects.map(p => p._id.toString());

        filteredProjectIds = filteredProjectIds.length
          ? filteredProjectIds.filter(id => dateIds.includes(id))
          : dateIds;
      }

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
      const grouped = {};

      issues.forEach(issue => {
        if (!issue.issueDate || !issue.projectId) return;

        const issueName = Array.isArray(issue.issueTitle)
          ? issue.issueTitle[0]
          : issue.issueTitle || 'Unknown Issue';

        const projectId = issue.projectId._id.toString();
        const projectName =
          issue.projectId.projectName ||
          issue.projectId.name ||
          'Unknown Project';

        const durationOpen = Math.ceil(
          (Date.now() - new Date(issue.issueDate)) /
            (1000 * 60 * 60 * 24 * 30.44),
        );

        if (!grouped[issueName]) grouped[issueName] = {};
        if (!grouped[issueName][projectId]) {
          grouped[issueName][projectId] = {
            projectId,
            projectName,
            durationOpen,
          };
        }
      });

      /* ---- final response ---- */
      const response = Object.entries(grouped)
        .map(([issueName, projects]) => ({
          issueName,
          projects: Object.values(projects),
        }))
        .slice(0, 7);

      res.json(response);
    } catch (error) {
      console.error('Error fetching longest open issues:', error);
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