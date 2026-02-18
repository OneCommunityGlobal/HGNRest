const mongoose = require('mongoose');
const Issue = require('../../models/bmdashboard/Issues');
const BuildingIssue = require('../../models/bmdashboard/buildingIssue');
const BuildingProject = require('../../models/bmdashboard/buildingProject');

// ---------- Constants ----------
// Required issue types for the Issues Breakdown Chart
// Chart displays only these three types as per requirements
const REQUIRED_ISSUE_TYPES = ['Equipment Issues', 'Labor Issues', 'Materials Issues'];

// Issue type mapping: Maps database issue types to the three required categories
// All issue types in the database will be categorized into one of these three categories
const ISSUE_TYPE_MAPPING = {
  // Equipment Issues - mechanical, electrical, maintenance related
  Electrical: 'Equipment Issues',
  Mechanical: 'Equipment Issues',
  Maintenance: 'Equipment Issues',

  // Labor Issues - labor/worker related
  Labor: 'Labor Issues',

  // Materials Issues - everything else (safety, technical, weather, etc.)
  Safety: 'Materials Issues',
  Technical: 'Materials Issues',
  Technical1: 'Materials Issues',
  Technical2: 'Materials Issues',
  Weather: 'Materials Issues',
  'METs quality / functionality': 'Materials Issues',
};

/**
 * Get all database issue types that map to a specific category
 * @param {string} category - One of the three required categories
 * @returns {string[]} Array of database issue types that map to this category
 */
const getIssueTypesForCategory = (category) =>
  Object.keys(ISSUE_TYPE_MAPPING).filter((type) => ISSUE_TYPE_MAPPING[type] === category);

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
 * Validates that the date is actually valid (not just format-matching)
 * @param {string} s - Date string in YYYY-MM-DD format
 * @returns {Date|null} UTC Date object or null if invalid
 */
const parseDateYYYYMMDD = (s) => {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s));
  if (!m) return null;
  const [, y, mo, d] = m;
  const year = +y;
  const month = +mo;
  const day = +d;

  // Validate month range (1-12)
  if (month < 1 || month > 12) return null;

  // Validate day range (1-31 is basic check, but we'll verify with date creation)
  if (day < 1 || day > 31) return null;

  // Create date in UTC
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

  // Verify the date didn't wrap around (e.g., 2024-13-45 becomes 2025-02-14)
  // If the parsed components don't match input, the date was invalid
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
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
  // If issueTypes filter is provided, we need to find all database issue types that map to those categories
  // If not provided, we include all database issue types (they will be mapped in aggregation)
  if (queryParams.issueTypes) {
    const requestedCategories = parseCSV(queryParams.issueTypes);
    // Filter to only include categories that are in REQUIRED_ISSUE_TYPES
    const validCategories = requestedCategories.filter((category) =>
      REQUIRED_ISSUE_TYPES.includes(category),
    );
    if (validCategories.length > 0) {
      // Get all database issue types that map to the requested categories
      const databaseIssueTypes = validCategories.flatMap((category) =>
        getIssueTypesForCategory(category),
      );
      if (databaseIssueTypes.length > 0) {
        match.issueType = { $in: databaseIssueTypes };
      } else {
        // If no database types map to requested categories, return empty result
        match.issueType = { $in: [] };
      }
    } else {
      // If none of the requested types are in REQUIRED_ISSUE_TYPES, return empty result
      match.issueType = { $in: [] };
    }
  }
  // If no issueTypes filter provided, don't filter by issueType - we'll map all types in aggregation

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

    // Build switch branches for MongoDB $switch operator
    // This maps database issue types to the three required categories
    const switchBranches = Object.keys(ISSUE_TYPE_MAPPING).map((dbType) => ({
      case: { $eq: ['$issueType', dbType] },
      then: ISSUE_TYPE_MAPPING[dbType],
    }));

    // Match filtered issues
    // If no filters provided, match will be empty object {} which matches all documents
    // Map issue types to categories and group by projectId and mapped category
    const aggregationPipeline = [
      { $match: match },
      // Add a field to map the database issue type to one of the three required categories
      {
        $addFields: {
          mappedIssueType: {
            $switch: {
              branches: switchBranches,
              default: 'Materials Issues', // Default for unmapped types
            },
          },
        },
      },
      // Group by projectId and mapped category to count issues
      {
        $group: {
          _id: {
            projectId: '$projectId',
            issueType: '$mappedIssueType', // Use mapped category instead of original type
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
          preserveNullAndEmptyArrays: true, // Changed to true to handle missing projects gracefully
        },
      },
      {
        $project: {
          _id: 0,
          projectId: { $toString: '$_id.projectId' },
          projectName: {
            $ifNull: [
              '$project.name',
              { $concat: ['Unknown Project (', { $toString: '$_id.projectId' }, ')'] },
            ],
          },
          issueType: '$_id.issueType', // This is now the mapped category
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

    // Get issue types (categories) to include in response
    // Chart requirement: Always use the three required categories (Equipment Issues, Labor Issues, Materials Issues)
    // If issueTypes filter was provided, use only those requested categories (filtered to REQUIRED_ISSUE_TYPES)
    // Otherwise, use all REQUIRED_ISSUE_TYPES
    let sortedIssueTypes = [];
    if (req.query.issueTypes) {
      // Extract requested categories from query parameters
      const requestedCategories = parseCSV(req.query.issueTypes);
      // Filter to only include categories that are in REQUIRED_ISSUE_TYPES
      const validCategories = requestedCategories.filter((category) =>
        REQUIRED_ISSUE_TYPES.includes(category),
      );
      if (validCategories.length > 0) {
        // Use only the requested valid categories
        sortedIssueTypes = validCategories.sort();
      } else {
        // If no valid categories requested, return empty result (no categories to display)
        sortedIssueTypes = [];
      }
    } else {
      // No issueTypes filter provided - use all REQUIRED_ISSUE_TYPES (sorted)
      sortedIssueTypes = [...REQUIRED_ISSUE_TYPES].sort();
    }

    // If no valid categories to display, return empty array
    if (sortedIssueTypes.length === 0) {
      return res.status(200).json([]);
    }

    // Reshape data - group by project and create objects with dynamic issue type properties
    const projectMap = new Map();

    // Process aggregated results
    aggregatedResults.forEach((item) => {
      const { projectId, projectName, issueType, count } = item;
      // issueType here is the mapped category (e.g., "Labor Issues", "Equipment Issues")
      // Only process if it's one of the categories we want in the response
      if (!sortedIssueTypes.includes(issueType)) {
        return; // Skip categories that aren't in the response set
      }

      if (!projectMap.has(projectId)) {
        const projectObj = {
          projectId,
          projectName,
        };
        // Initialize all issue types (categories) with 0
        sortedIssueTypes.forEach((type) => {
          projectObj[type] = 0;
        });
        projectMap.set(projectId, projectObj);
      }
      const projectObj = projectMap.get(projectId);
      projectObj[issueType] = count;
    });

    // Edge Case - Projects Filter with No Matching Issues
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

    // Convert map to array and sort by projectName
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
