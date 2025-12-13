/**
 * Material Cost Correlation Helper Utilities
 *
 * Centralizes MongoDB aggregation logic for material usage and cost calculations.
 * Prevents duplication between similar aggregation patterns and makes code testable.
 */

const mongoose = require('mongoose');
const logger = require('../startup/logger');

/**
 * Build base match condition for filtering by project and material type.
 * Helper function to avoid duplication between usage and cost aggregations.
 *
 * @param {string[]} projectIds - Array of project ObjectId strings (empty = all projects)
 * @param {string[]} materialTypeIds - Array of material type ObjectId strings (empty = all materials)
 * @returns {Object} MongoDB match condition object
 */
function buildBaseMatchForMaterials(projectIds, materialTypeIds) {
  const baseMatch = {};

  if (projectIds && projectIds.length > 0) {
    const projectObjectIds = projectIds.map((id) => new mongoose.Types.ObjectId(id));
    baseMatch.project = { $in: projectObjectIds };
  }

  if (materialTypeIds && materialTypeIds.length > 0) {
    const materialTypeObjectIds = materialTypeIds.map((id) => new mongoose.Types.ObjectId(id));
    baseMatch.itemType = { $in: materialTypeObjectIds };
  }

  return baseMatch;
}

/**
 * Find the earliest date from either updateRecord or purchaseRecord arrays,
 * considering project and material type filters.
 * Used when startDate is not provided.
 *
 * @param {string[]} projectIds - Array of project ObjectId strings (empty = all projects)
 * @param {string[]} materialTypeIds - Array of material type ObjectId strings (empty = all materials)
 * @param {Object} BuildingMaterial - Mongoose model for buildingMaterials collection
 * @returns {Promise<Date|null>} Date object representing earliest record, or null if none found
 */
async function getEarliestRelevantMaterialDate(projectIds, materialTypeIds, BuildingMaterial) {
  try {
    // Build base match condition
    const baseMatch = buildBaseMatchForMaterials(projectIds, materialTypeIds);

    // Query for earliest updateRecord date
    const updateRecordPipeline = [
      { $match: baseMatch },
      { $unwind: '$updateRecord' },
      { $match: { 'updateRecord.date': { $exists: true, $ne: null } } },
      {
        $group: {
          _id: null,
          minDate: { $min: '$updateRecord.date' },
        },
      },
    ];

    // Query for earliest purchaseRecord date (approved only)
    const purchaseRecordPipeline = [
      { $match: baseMatch },
      { $unwind: '$purchaseRecord' },
      {
        $match: {
          'purchaseRecord.date': { $exists: true, $ne: null },
          'purchaseRecord.status': 'Approved',
        },
      },
      {
        $group: {
          _id: null,
          minDate: { $min: '$purchaseRecord.date' },
        },
      },
    ];

    // Run both queries in parallel
    const [updateResult, purchaseResult] = await Promise.all([
      BuildingMaterial.aggregate(updateRecordPipeline).exec(),
      BuildingMaterial.aggregate(purchaseRecordPipeline).exec(),
    ]);

    // Extract minDate from results
    const updateMinDate =
      updateResult.length > 0 && updateResult[0].minDate ? updateResult[0].minDate : null;
    const purchaseMinDate =
      purchaseResult.length > 0 && purchaseResult[0].minDate ? purchaseResult[0].minDate : null;

    // Find overall minimum
    if (updateMinDate === null && purchaseMinDate === null) {
      return null;
    }
    if (updateMinDate === null) {
      return purchaseMinDate;
    }
    if (purchaseMinDate === null) {
      return updateMinDate;
    }

    // Both have dates - return the earlier one
    return updateMinDate.getTime() < purchaseMinDate.getTime() ? updateMinDate : purchaseMinDate;
  } catch (error) {
    logger.logException(error, 'getEarliestRelevantMaterialDate', {
      projectIds,
      materialTypeIds,
    });
    return null;
  }
}

/**
 * Calculate total quantity used per project and per material type within the date range.
 * Aggregates from updateRecord arrays.
 *
 * @param {Object} BuildingMaterial - Mongoose model
 * @param {Object} filters - Filter object with projectIds and materialTypeIds arrays
 * @param {string[]} filters.projectIds - Array of project ObjectId strings (empty = all projects)
 * @param {string[]} filters.materialTypeIds - Array of material type ObjectId strings (empty = all materials)
 * @param {Object} dateRange - Date range object with effectiveStart and effectiveEnd
 * @param {Date} dateRange.effectiveStart - UTC Date object for range start
 * @param {Date} dateRange.effectiveEnd - UTC Date object for range end
 * @returns {Promise<Array>} Promise resolving to array of objects with projectId, materialTypeId, quantityUsed
 */
async function aggregateMaterialUsage(BuildingMaterial, filters, dateRange) {
  try {
    const { projectIds, materialTypeIds } = filters;
    const { effectiveStart, effectiveEnd } = dateRange;

    // Build initial match stage
    const baseMatch = buildBaseMatchForMaterials(projectIds, materialTypeIds);

    // Create aggregation pipeline
    const pipeline = [
      // Stage 1: Match by project/material filters
      { $match: baseMatch },
      // Stage 2: Unwind updateRecord array
      { $unwind: '$updateRecord' },
      // Stage 3: Filter updateRecords by date range and ensure quantityUsed exists
      {
        $match: {
          'updateRecord.date': {
            $gte: effectiveStart,
            $lte: effectiveEnd,
          },
          'updateRecord.quantityUsed': { $exists: true, $ne: null, $type: 'number' },
        },
      },
      // Stage 4: Group by project and itemType, sum quantityUsed
      {
        $group: {
          _id: {
            project: '$project',
            itemType: '$itemType',
          },
          quantityUsed: { $sum: '$updateRecord.quantityUsed' },
        },
      },
      // Stage 5: Reshape output
      {
        $project: {
          _id: 0,
          projectId: '$_id.project',
          materialTypeId: '$_id.itemType',
          quantityUsed: 1,
        },
      },
    ];

    const results = await BuildingMaterial.aggregate(pipeline).exec();
    return results;
  } catch (error) {
    logger.logException(error, 'aggregateMaterialUsage', {
      projectIds: filters?.projectIds,
      materialTypeIds: filters?.materialTypeIds,
      effectiveStart: dateRange?.effectiveStart?.toISOString(),
      effectiveEnd: dateRange?.effectiveEnd?.toISOString(),
    });
    return [];
  }
}

/**
 * Calculate total cost per project and per material type from approved purchases within the date range.
 * Aggregates from purchaseRecord arrays.
 *
 * @param {Object} BuildingMaterial - Mongoose model
 * @param {Object} filters - Filter object with projectIds and materialTypeIds arrays
 * @param {string[]} filters.projectIds - Array of project ObjectId strings (empty = all projects)
 * @param {string[]} filters.materialTypeIds - Array of material type ObjectId strings (empty = all materials)
 * @param {Object} dateRange - Date range object with effectiveStart and effectiveEnd
 * @param {Date} dateRange.effectiveStart - UTC Date object for range start
 * @param {Date} dateRange.effectiveEnd - UTC Date object for range end
 * @returns {Promise<Array>} Promise resolving to array of objects with projectId, materialTypeId, totalCost
 */
async function aggregateMaterialCost(BuildingMaterial, filters, dateRange) {
  try {
    const { projectIds, materialTypeIds } = filters;
    const { effectiveStart, effectiveEnd } = dateRange;

    // Build initial match stage (reuse helper)
    const baseMatch = buildBaseMatchForMaterials(projectIds, materialTypeIds);

    // Create aggregation pipeline
    const pipeline = [
      // Stage 1: Match by project/material filters
      { $match: baseMatch },
      // Stage 2: Unwind purchaseRecord array
      { $unwind: '$purchaseRecord' },
      // Stage 3: Filter purchaseRecords by status, date range, and ensure required fields exist
      {
        $match: {
          'purchaseRecord.status': 'Approved',
          'purchaseRecord.date': {
            $gte: effectiveStart,
            $lte: effectiveEnd,
          },
          'purchaseRecord.unitPrice': { $exists: true, $ne: null, $type: 'number', $gte: 0 },
          'purchaseRecord.quantity': { $exists: true, $ne: null, $type: 'number', $gte: 0 },
        },
      },
      // Stage 4: Group by project and itemType, sum total cost
      {
        $group: {
          _id: {
            project: '$project',
            itemType: '$itemType',
          },
          totalCost: {
            $sum: {
              $multiply: ['$purchaseRecord.unitPrice', '$purchaseRecord.quantity'],
            },
          },
        },
      },
      // Stage 5: Reshape output
      {
        $project: {
          _id: 0,
          projectId: '$_id.project',
          materialTypeId: '$_id.itemType',
          totalCost: 1,
        },
      },
    ];

    const results = await BuildingMaterial.aggregate(pipeline).exec();
    return results;
  } catch (error) {
    logger.logException(error, 'aggregateMaterialCost', {
      projectIds: filters?.projectIds,
      materialTypeIds: filters?.materialTypeIds,
      effectiveStart: dateRange?.effectiveStart?.toISOString(),
      effectiveEnd: dateRange?.effectiveEnd?.toISOString(),
    });
    return [];
  }
}

module.exports = {
  getEarliestRelevantMaterialDate,
  aggregateMaterialUsage,
  aggregateMaterialCost,
  buildBaseMatchForMaterials, // Export for testing/reuse
};
