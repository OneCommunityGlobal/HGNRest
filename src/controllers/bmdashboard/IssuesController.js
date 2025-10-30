const mongoose = require('mongoose');
const Issue = require('../../models/bmdashboard/Issues');
const BuildingIssue = require('../../models/bmdashboard/buildingIssue');
const BuildingProject = require('../../models/bmdashboard/buildingProject');

// ---------- Constants ----------
// Required issue types for the Issues Breakdown Chart
// Chart displays only these three types as per requirements
const REQUIRED_ISSUE_TYPES = ['Equipment Issues', 'Labor Issues', 'Materials Issues'];

// ---------- Helper Functions ----------

/**
 * Parse comma-separated values, trim whitespace, and filter empty values
 * @param {string} s - Comma-separated string
 * @returns {string[]} Array of trimmed, non-empty values
 */
const parseCSV = (s = '') =>
  String(s)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

/**
 * Validate YYYY-MM-DD format and convert to UTC Date
 * @param {string} s - Date string in YYYY-MM-DD format
 * @returns {Date|null} UTC Date object or null if invalid
 */
const parseDateYYYYMMDD = (s) => {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s));
  if (!m) return null;
  const [, y, mo, d] = m;
  return new Date(Date.UTC(+y, +mo - 1, +d, 0, 0, 0, 0));
};

/**
 * Parse comma-separated MongoDB ObjectIds, validate, and return arrays
 * @param {string} s - Comma-separated string of ObjectIds
 * @returns {{objectIds: mongoose.Types.ObjectId[], invalidIds: string[]}} Object with valid ObjectIds and invalid ID strings
 */
const parseObjectIdsCSV = (s = '') => {
  const ids = parseCSV(s);
  const validIds = ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
  return {
    objectIds: validIds.map((id) => new mongoose.Types.ObjectId(id)),
    invalidIds: ids.filter((id) => !mongoose.Types.ObjectId.isValid(id)),
  };
};

/**
 * Validate all query parameters and return validation errors
 * @param {object} queryParams - Request query parameters
 * @returns {string[]} Array of validation error messages
 */
const validateQueryParams = (queryParams) => {
  const errors = [];

  // Validate projects parameter
  if (queryParams.projects) {
    const { invalidIds } = parseObjectIdsCSV(queryParams.projects);
    if (invalidIds.length > 0) {
      errors.push(`Invalid project IDs: ${invalidIds.join(', ')}`);
    }
  }

  // Validate startDate parameter
  if (queryParams.startDate) {
    const startDate = parseDateYYYYMMDD(queryParams.startDate);
    if (!startDate) {
      errors.push(
        `Invalid startDate format: ${queryParams.startDate}. Expected YYYY-MM-DD format.`,
      );
    }
  }

  // Validate endDate parameter
  if (queryParams.endDate) {
    const endDate = parseDateYYYYMMDD(queryParams.endDate);
    if (!endDate) {
      errors.push(`Invalid endDate format: ${queryParams.endDate}. Expected YYYY-MM-DD format.`);
    }
  }

  return errors;
};

/**
 * Build MongoDB match query object based on provided filters
 * Handles edge cases:
 * - Date Range: Uses UTC for all date comparisons
 * - startDate: Set to beginning of day (00:00:00 UTC)
 * - endDate: Set to end of day (23:59:59.999 UTC) for inclusive filtering
 * - Invalid Issue Types: Silently filtered out (forgiving UX)
 * @param {object} queryParams - Request query parameters
 * @returns {{match: object, errors: string[]}} Object with MongoDB match query and validation errors
 */
const buildMatchQuery = (queryParams) => {
  const match = {};
  const errors = validateQueryParams(queryParams);

  // Parse and add projects filter
  if (queryParams.projects) {
    const { objectIds } = parseObjectIdsCSV(queryParams.projects);
    if (objectIds.length > 0) {
      match.projectId = { $in: objectIds };
    }
  }

  // Parse and add startDate filter
  if (queryParams.startDate) {
    const startDate = parseDateYYYYMMDD(queryParams.startDate);
    if (startDate) {
      // startDate is already at beginning of day (00:00:00 UTC) from parseDateYYYYMMDD
      match.issueDate = { ...match.issueDate, $gte: startDate };
    }
  }

  // Parse and add endDate filter
  if (queryParams.endDate) {
    const endDate = parseDateYYYYMMDD(queryParams.endDate);
    if (endDate) {
      // Make endDate inclusive of the entire day (23:59:59.999 UTC)
      const endDateInclusive = new Date(endDate);
      endDateInclusive.setUTCHours(23, 59, 59, 999);
      match.issueDate = { ...match.issueDate, $lte: endDateInclusive };
    }
  }

  // Parse issueTypes parameter and restrict to REQUIRED_ISSUE_TYPES
  // Chart requirement: Only display "Equipment Issues", "Labor Issues", "Materials Issues"
  // If issueTypes filter is provided, intersect with REQUIRED_ISSUE_TYPES
  // If not provided, use all REQUIRED_ISSUE_TYPES
  if (queryParams.issueTypes) {
    const requestedTypes = parseCSV(queryParams.issueTypes);
    // Filter to only include types that are in REQUIRED_ISSUE_TYPES
    const filteredTypes = requestedTypes.filter((type) => REQUIRED_ISSUE_TYPES.includes(type));
    if (filteredTypes.length > 0) {
      match.issueType = { $in: filteredTypes };
    } else {
      // If none of the requested types are in REQUIRED_ISSUE_TYPES, return empty result
      // Set a flag that will result in no matches
      match.issueType = { $in: [] };
    }
  } else {
    // No issueTypes filter provided - use all REQUIRED_ISSUE_TYPES
    match.issueType = { $in: REQUIRED_ISSUE_TYPES };
  }

  return { match, errors };
};

// ---------- Controller Methods ----------

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

/**
 * Get issue statistics for all projects with filtering support
 * Supports filtering by projects, date range, and issue types
 * Returns aggregated issue counts grouped by project with three specific issue type properties:
 * - "Equipment Issues"
 * - "Labor Issues"
 * - "Materials Issues"
 * Chart requirement: Only these three issue types are displayed
 * @param {object} req - Express request object with optional query params: projects, startDate, endDate, issueTypes
 * @param {object} res - Express response object
 */
exports.getIssueStatistics = async (req, res) => {
  try {
    // Build match query and validate parameters
    const { match, errors } = buildMatchQuery(req.query);

    // Return 400 if validation errors exist
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join(' ') });
    }

    // Get filtered project IDs if projects filter was provided
    // This is used later to handle edge case: projects with no issues
    const filteredProjectIds = match.projectId?.$in || null;

    // Stage 1: Match filtered issues
    // If no filters provided, match will be empty object {} which matches all documents
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
      // Lookup project names
      // Limit fields returned to only what's needed for performance
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

    // Execute aggregation with allowDiskUse for memory-intensive operations
    const aggregatedResults = await BuildingIssue.aggregate(aggregationPipeline).option({
      allowDiskUse: true,
    });

    // Edge Case: Filters Return No Results
    // If aggregation returns no results, we'll return empty array [] with 200 status
    // Frontend handles empty arrays gracefully

    // Get issue types to include in response
    // Chart requirement: Always use the three required issue types
    // If issueTypes filter was provided and matched, use those filtered types
    // Otherwise, use all REQUIRED_ISSUE_TYPES
    let sortedIssueTypes = [];
    if (match.issueType?.$in && match.issueType.$in.length > 0) {
      // Use filtered issue types (already restricted to REQUIRED_ISSUE_TYPES in buildMatchQuery)
      sortedIssueTypes = match.issueType.$in.sort();
    } else {
      // Use all REQUIRED_ISSUE_TYPES (sorted)
      sortedIssueTypes = [...REQUIRED_ISSUE_TYPES].sort();
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

    // Stage 6: Edge Case - Projects Filter with No Matching Issues
    // If projects filter was provided, include projects with no issues
    // Set all issue type counts to 0 for these projects
    if (filteredProjectIds && filteredProjectIds.length > 0) {
      const projectIdsInResults = new Set(Array.from(projectMap.keys()).map((id) => id.toString()));
      const filteredProjectIdsStr = filteredProjectIds.map((id) => id.toString());

      // Find projects that were filtered but have no issues
      const missingProjectIds = filteredProjectIdsStr.filter((id) => !projectIdsInResults.has(id));

      if (missingProjectIds.length > 0) {
        // Query buildingProject collection for project names
        // Limit fields returned to only _id and name for performance
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

    // Edge Case: Filters Return No Results
    // If result is empty array, return [] with 200 status (frontend handles this gracefully)
    res.status(200).json(result);
  } catch (error) {
    console.error('[getIssueStatistics] Error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
};

/**
 * Get all available issue types from the database
 * Returns distinct issue types sorted alphabetically
 * @param {object} _req - Express request object (unused)
 * @param {object} res - Express response object
 */
exports.getIssueTypes = async (_req, res) => {
  try {
    const issueTypes = await BuildingIssue.distinct('issueType');
    const filteredIssueTypes = issueTypes.filter(Boolean).sort();
    res.status(200).json({ issueTypes: filteredIssueTypes });
  } catch (error) {
    console.error('[getIssueTypes] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
