const mongoose = require('mongoose');
const Issue = require('../../models/bmdashboard/Issues');
const BuildingIssue = require('../../models/bmdashboard/buildingIssue');
const BuildingProject = require('../../models/bmdashboard/buildingProject');

// ---------- Helper Functions ----------
const parseCSV = (s = '') =>
  String(s)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

const parseYmdUtc = (s) => {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s));
  if (!m) return null;
  const [, y, mo, d] = m;
  return new Date(Date.UTC(+y, +mo - 1, +d, 0, 0, 0, 0));
};

const parseObjectIdsCSV = (s = '') => {
  const ids = parseCSV(s);
  const validIds = ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
  return {
    objectIds: validIds.map((id) => new mongoose.Types.ObjectId(id)),
    invalidIds: ids.filter((id) => !mongoose.Types.ObjectId.isValid(id)),
  };
};

const buildMatchQuery = (queryParams) => {
  const match = {};
  const errors = [];

  // Parse and validate projects parameter
  if (queryParams.projects) {
    const { objectIds, invalidIds } = parseObjectIdsCSV(queryParams.projects);
    if (invalidIds.length > 0) {
      errors.push(`Invalid project IDs: ${invalidIds.join(', ')}`);
    }
    if (objectIds.length > 0) {
      match.projectId = { $in: objectIds };
    }
  }

  // Parse and validate startDate parameter
  if (queryParams.startDate) {
    const startDate = parseYmdUtc(queryParams.startDate);
    if (!startDate) {
      errors.push(
        `Invalid startDate format: ${queryParams.startDate}. Expected YYYY-MM-DD format.`,
      );
    } else {
      match.issueDate = { ...match.issueDate, $gte: startDate };
    }
  }

  // Parse and validate endDate parameter
  if (queryParams.endDate) {
    const endDate = parseYmdUtc(queryParams.endDate);
    if (!endDate) {
      errors.push(`Invalid endDate format: ${queryParams.endDate}. Expected YYYY-MM-DD format.`);
    } else {
      // Make endDate inclusive of the entire day
      const endDateInclusive = new Date(endDate);
      endDateInclusive.setUTCDate(endDateInclusive.getUTCDate() + 1);
      endDateInclusive.setUTCMilliseconds(endDateInclusive.getUTCMilliseconds() - 1);
      match.issueDate = { ...match.issueDate, $lte: endDateInclusive };
    }
  }

  // Parse issueTypes parameter (forgiving - filter invalid ones out)
  if (queryParams.issueTypes) {
    const issueTypes = parseCSV(queryParams.issueTypes);
    if (issueTypes.length > 0) {
      match.issueType = { $in: issueTypes };
    }
  }

  return { match, errors };
};

// Get all issues for a specific project
exports.getIssuesByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const issues = await Issue.find({ projectId });
    res.json(issues);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get issues by type for a specific project
exports.getIssuesByType = async (req, res) => {
  try {
    const { projectId, issueType } = req.params;
    const issues = await Issue.find({ projectId, issueType });
    res.json(issues);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create a new issue
exports.createIssue = async (req, res) => {
  try {
    const issue = new Issue({
      projectName: req.body.projectName,
      equipmentIssues: req.body.equipmentIssues || 0,
      laborIssues: req.body.laborIssues || 0,
      materialIssues: req.body.materialIssues || 0,
    });
    await issue.save();
    res.status(201).json(issue);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Update an existing issue
exports.updateIssue = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const issue = await Issue.findByIdAndUpdate(id, updates, { new: true });
    if (!issue) {
      return res.status(404).json({ message: 'Issue not found' });
    }
    res.json(issue);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete an issue
exports.deleteIssue = async (req, res) => {
  try {
    const { id } = req.params;
    const issue = await Issue.findByIdAndDelete(id);
    if (!issue) {
      return res.status(404).json({ message: 'Issue not found' });
    }
    res.json({ message: 'Issue deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get issue statistics for all projects with filtering support
exports.getIssueStatistics = async (req, res) => {
  try {
    // Build match query and validate parameters
    const { match, errors } = buildMatchQuery(req.query);

    // Return 400 if validation errors exist
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join(' ') });
    }

    // Get filtered project IDs if projects filter was provided
    const filteredProjectIds = match.projectId?.$in || null;

    // Stage 1: Match filtered issues
    // Stage 2: Group by projectId and issueType to count issues
    const aggregationPipeline = [
      { $match: match },
      {
        $group: {
          _id: {
            projectId: '$projectId',
            issueType: '$issueType',
          },
          count: { $sum: 1 },
        },
      },
      // Stage 3: Lookup project names
      {
        $lookup: {
          from: 'buildingProjects',
          localField: '_id.projectId',
          foreignField: '_id',
          as: 'project',
        },
      },
      {
        $unwind: {
          path: '$project',
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $project: {
          _id: 0,
          projectId: { $toString: '$_id.projectId' },
          projectName: { $ifNull: ['$project.name', 'Unknown'] },
          issueType: '$_id.issueType',
          count: 1,
        },
      },
      {
        $sort: { projectName: 1 },
      },
    ];

    const aggregatedResults = await BuildingIssue.aggregate(aggregationPipeline).option({
      allowDiskUse: true,
    });

    // Get issue types to include in response
    // If issueTypes filter was provided, only use those types
    // Otherwise, get all distinct issue types from filtered dataset
    let sortedIssueTypes = [];
    if (match.issueType?.$in) {
      // Use filtered issue types
      sortedIssueTypes = match.issueType.$in.sort();
    } else {
      // Get all distinct issue types from filtered dataset
      const distinctIssueTypes = await BuildingIssue.distinct('issueType', match).catch(() => []);
      sortedIssueTypes = distinctIssueTypes.filter(Boolean).sort();
    }

    // Stage 4 & 5: Reshape data - group by project and create objects with dynamic issue type properties
    const projectMap = new Map();

    // Process aggregated results
    aggregatedResults.forEach((item) => {
      const { projectId, projectName, issueType, count } = item;
      if (!projectMap.has(projectId)) {
        const projectObj = {
          projectId,
          projectName,
        };
        // Initialize all issue types with 0
        sortedIssueTypes.forEach((type) => {
          projectObj[type] = 0;
        });
        projectMap.set(projectId, projectObj);
      }
      const projectObj = projectMap.get(projectId);
      projectObj[issueType] = count;
    });

    // Stage 6: Handle filtered projects edge case
    // If projects filter was provided, include projects with no issues
    if (filteredProjectIds && filteredProjectIds.length > 0) {
      const projectIdsInResults = new Set(Array.from(projectMap.keys()).map((id) => id.toString()));
      const filteredProjectIdsStr = filteredProjectIds.map((id) => id.toString());

      // Find projects that were filtered but have no issues
      const missingProjectIds = filteredProjectIdsStr.filter((id) => !projectIdsInResults.has(id));

      if (missingProjectIds.length > 0) {
        // Query buildingProject collection for project names
        const missingProjects = await BuildingProject.find({
          _id: { $in: missingProjectIds.map((id) => new mongoose.Types.ObjectId(id)) },
        })
          .select('_id name')
          .lean();

        // Add missing projects with all issue types set to 0
        missingProjects.forEach((project) => {
          const projectObj = {
            projectId: project._id.toString(),
            projectName: project.name || 'Unknown',
          };
          sortedIssueTypes.forEach((type) => {
            projectObj[type] = 0;
          });
          projectMap.set(projectObj.projectId, projectObj);
        });
      }
    }

    // Stage 7: Convert map to array and sort by projectName
    const result = Array.from(projectMap.values()).sort((a, b) =>
      a.projectName.localeCompare(b.projectName),
    );

    res.status(200).json(result);
  } catch (error) {
    console.error('[getIssueStatistics] Error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};
