const mongoose = require('mongoose');
const MaterialUsage = require('../models/materialUsage');

/**
 * @desc    Get Material Utilization data aggregated by project
 * @route   GET /api/materials/utilization
 * @access  Private
 */
const getMaterialUtilization = async (req, res) => {
  const { start, end, projects, materials } = req.query;

  // --- 1. Validation ---
  if (!start || !end) {
    return res
      .status(400)
      .json({ success: false, message: 'Both start and end dates are required' });
  }

  let startDate;
  let endDate;

  try {
    startDate = new Date(start);
    endDate = new Date(end);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new Error('Invalid date format');
    }
  } catch (error) {
    return res
      .status(400)
      .json({ success: false, message: 'Invalid date format. Please use ISO date strings.' });
  }

  if (startDate > endDate) {
    return res.status(400).json({ success: false, message: 'Start date cannot be after end date' });
  }

  // --- 2. Build Initial Match Stage ---
  const matchStage = {
    date: {
      $gte: startDate,
      $lte: endDate,
    },
  };

  // If project filters are provided, add them to the match stage
  if (projects && Array.isArray(projects) && projects.length > 0) {
    try {
      // Convert string IDs to valid MongoDB ObjectIds
      const projectObjectIds = projects.map((id) => new mongoose.Types.ObjectId(id));
      matchStage.projectId = { $in: projectObjectIds };
    } catch (error) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid project ID format provided.' });
    }
  }

  if (materials && Array.isArray(materials) && materials.length > 0) {
    try {
      // Convert material string IDs to ObjectIds
      const materialObjectIds = materials.map((id) => new mongoose.Types.ObjectId(id));
      matchStage.materialId = { $in: materialObjectIds };
    } catch (error) {
      return res.status(400).json({ success: false, message: 'Invalid material ID format.' });
    }
  }

  // --- 3. Aggregation Pipeline ---
  try {
    const aggregationPipeline = [
      // Stage 1: Filter documents by date and optional projects
      {
        $match: matchStage,
      },
      // Stage 2: Group by projectId to sum up quantities
      {
        $group: {
          _id: '$projectId',
          projectName: { $first: '$projectName' }, // Get the first project name found
          totalHandled: { $sum: '$receivedQty' },
          used: { $sum: '$usedQty' },
        },
      },
      // Stage 3: Calculate unused, and handle division by zero
      {
        $project: {
          _id: 0, // Exclude the default _id
          project: '$projectName',
          used: '$used',
          unused: { $max: [0, { $subtract: ['$totalHandled', '$used'] }] },
          totalHandled: '$totalHandled', // Pass totalHandled to the next stage
        },
      },
      // Stage 4: Calculate percentages
      {
        $project: {
          project: 1,
          used: 1,
          unused: 1,
          totalHandled: 1,
          // Use $cond to prevent division by zero if totalHandled is 0
          usedPct: {
            $cond: {
              if: { $eq: ['$totalHandled', 0] },
              then: 0,
              else: {
                $round: [
                  { $multiply: [{ $divide: ['$used', '$totalHandled'] }, 100] },
                  1, // Round to 1 decimal place
                ],
              },
            },
          },
        },
      },
      // Stage 5: Calculate unusedPct and final formatting
      {
        $project: {
          project: 1,
          totalHandled: 1,
          used: 1,
          unused: 1,
          usedPct: 1,
          unusedPct: { $subtract: [100, '$usedPct'] },
        },
      },
      // Stage 6: Sort by project name as requested
      {
        $sort: { project: 1 },
      },
    ];

    const utilizationData = await MaterialUsage.aggregate(aggregationPipeline);

    if (utilizationData.length === 0) {
      // Per spec, return 404 if no records found
      return res
        .status(404)
        .json({ success: false, message: 'No material records for selected range' });
    }

    res.status(200).json(utilizationData); // Send the successful response
  } catch (error) {
    console.error('Error in Material Utilization Aggregation:', error.message);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

/**
 * @desc    Get all distinct projects for the filter dropdown
 * @route   GET /api/materials/distinct-projects
 * @access  Private
 */
const getDistinctProjects = async (req, res) => {
  try {
    // This finds all unique projectId/projectName pairs
    const projectData = await MaterialUsage.aggregate([
      {
        $group: {
          _id: '$projectId',
          projectName: { $first: '$projectName' },
        },
      },
      { $sort: { projectName: 1 } },
      // Send it in the format { _id: "...", projectName: "..." }
      {
        $project: {
          _id: 1,
          projectName: 1,
        },
      },
    ]);

    res.status(200).json(projectData);
  } catch (error) {
    console.error('Error fetching distinct projects:', error.message);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

/**
 * @desc    Get all distinct materials for the filter dropdown
 * @route   GET /api/materials/distinct-materials
 * @access  Private
 */
const getDistinctMaterials = async (req, res) => {
  try {
    const materialData = await MaterialUsage.aggregate([
      {
        $group: {
          _id: '$materialId',
          materialName: { $first: '$materialName' },
        },
      },
      { $sort: { materialName: 1 } },
      {
        $project: {
          _id: 1,
          materialName: 1,
        },
      },
    ]);

    res.status(200).json(materialData);
  } catch (error) {
    console.error('Error fetching distinct materials:', error.message);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

module.exports = {
  getMaterialUtilization,
  getDistinctProjects,
  getDistinctMaterials,
};
