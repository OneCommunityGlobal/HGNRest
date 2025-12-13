/**
 * Material Cost Correlation Helper Utilities
 *
 * Centralizes MongoDB aggregation logic for material usage and cost calculations.
 * Prevents duplication between similar aggregation patterns and makes code testable.
 */

const mongoose = require('mongoose');
const logger = require('../startup/logger');

/**
 * Convert array of string IDs to ObjectIds.
 * Helper function to avoid duplication of ObjectId conversion pattern.
 *
 * @param {string[]} idStrings - Array of ObjectId strings
 * @returns {Object[]} Array of mongoose ObjectIds
 */
function convertStringsToObjectIds(idStrings) {
  return idStrings.map((id) => new mongoose.Types.ObjectId(id));
}

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
    const projectObjectIds = convertStringsToObjectIds(projectIds);
    baseMatch.project = { $in: projectObjectIds };
  }

  if (materialTypeIds && materialTypeIds.length > 0) {
    const materialTypeObjectIds = convertStringsToObjectIds(materialTypeIds);
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

/**
 * Calculate cost per unit with division-by-zero handling.
 * Helper function to avoid duplication.
 *
 * @param {number} totalCost - Total cost
 * @param {number} quantityUsed - Quantity used
 * @returns {number|null} Cost per unit, or null if quantityUsed is 0
 */
function calculateCostPerUnit(totalCost, quantityUsed) {
  if (!quantityUsed || quantityUsed === 0) {
    return null;
  }
  const result = totalCost / quantityUsed;
  // Handle NaN or Infinity
  if (!Number.isFinite(result)) {
    return null;
  }
  // Round to 2 decimal places
  return Math.round(result * 100) / 100;
}

// Constants
const COST_SCALE_K = 1000;

/**
 * Calculate total cost in thousands (K).
 * Helper function to avoid duplication.
 *
 * @param {number} totalCost - Total cost
 * @returns {number} Total cost divided by 1000
 */
function calculateTotalCostK(totalCost) {
  return totalCost / COST_SCALE_K;
}

/**
 * Convert ObjectId to string safely.
 *
 * @param {Object|string} id - ObjectId or string
 * @returns {string} String representation of the ID
 */
function objectIdToString(id) {
  if (!id) {
    return '';
  }
  return id.toString ? id.toString() : String(id);
}

/**
 * Build cost correlation response by merging usage and cost data,
 * enriching with project/material names, and computing derived values.
 *
 * @param {Array} usageData - Array from aggregateMaterialUsage
 * @param {Array} costData - Array from aggregateMaterialCost
 * @param {Object} requestParams - Request parameters object
 * @param {string[]} requestParams.projectIds - Original requested project IDs
 * @param {string[]} requestParams.materialTypeIds - Original requested material type IDs
 * @param {Object} requestParams.dateRangeMeta - Object from date normalization function
 * @param {Object} models - Models object
 * @param {Object} models.BuildingProject - Mongoose model for projects
 * @param {Object} models.BuildingInventoryType - Mongoose model for inventory types (use invTypeBase)
 * @returns {Promise<Object>} Structured response object with meta and data
 */
// eslint-disable-next-line max-lines-per-function
async function buildCostCorrelationResponse(usageData, costData, requestParams, models) {
  const { projectIds, materialTypeIds, dateRangeMeta } = requestParams;
  const { BuildingProject, BuildingInventoryType } = models;
  try {
    // 1. Create lookup maps for performance
    const projectIdSet = new Set();
    const materialTypeIdSet = new Set();

    // Collect unique project IDs from usage and cost data
    [...usageData, ...costData].forEach((item) => {
      if (item.projectId) {
        projectIdSet.add(objectIdToString(item.projectId));
      }
      if (item.materialTypeId) {
        materialTypeIdSet.add(objectIdToString(item.materialTypeId));
      }
    });

    // Include explicitly requested IDs for completeness
    projectIds.forEach((id) => projectIdSet.add(String(id)));
    materialTypeIds.forEach((id) => materialTypeIdSet.add(String(id)));

    const allUniqueProjectIds = convertStringsToObjectIds(Array.from(projectIdSet));
    const allUniqueMaterialTypeIds = convertStringsToObjectIds(Array.from(materialTypeIdSet));

    // Query project names and material type names/units in parallel
    const projectMap = new Map();
    const materialTypeMap = new Map();

    try {
      const [projects, materialTypes] = await Promise.all([
        allUniqueProjectIds.length > 0
          ? BuildingProject.find({ _id: { $in: allUniqueProjectIds } }).exec()
          : Promise.resolve([]),
        allUniqueMaterialTypeIds.length > 0
          ? BuildingInventoryType.find({ _id: { $in: allUniqueMaterialTypeIds } }).exec()
          : Promise.resolve([]),
      ]);

      // Build project name map
      projects.forEach((project) => {
        const idStr = objectIdToString(project._id);
        projectMap.set(idStr, project.name || idStr);
      });

      // Build material type map (name and unit)
      materialTypes.forEach((material) => {
        const idStr = objectIdToString(material._id);
        materialTypeMap.set(idStr, {
          name: material.name || idStr,
          unit: material.unit || '',
        });
      });
    } catch (lookupError) {
      logger.logException(lookupError, 'buildCostCorrelationResponse - lookup queries', {
        projectIds: allUniqueProjectIds.length,
        materialTypeIds: allUniqueMaterialTypeIds.length,
      });
      // Continue with empty maps - will use fallbacks
    }

    // 2. Merge usage and cost data by composite key
    const mergedData = new Map();

    usageData.forEach((item) => {
      const projectIdStr = objectIdToString(item.projectId);
      const materialTypeIdStr = objectIdToString(item.materialTypeId);
      const key = `${projectIdStr}-${materialTypeIdStr}`;

      if (!mergedData.has(key)) {
        mergedData.set(key, {
          projectId: projectIdStr,
          materialTypeId: materialTypeIdStr,
          quantityUsed: 0,
          totalCost: 0,
        });
      }
      mergedData.get(key).quantityUsed = item.quantityUsed || 0;
    });

    costData.forEach((item) => {
      const projectIdStr = objectIdToString(item.projectId);
      const materialTypeIdStr = objectIdToString(item.materialTypeId);
      const key = `${projectIdStr}-${materialTypeIdStr}`;

      if (!mergedData.has(key)) {
        mergedData.set(key, {
          projectId: projectIdStr,
          materialTypeId: materialTypeIdStr,
          quantityUsed: 0,
          totalCost: 0,
        });
      }
      mergedData.get(key).totalCost = item.totalCost || 0;
    });

    // 3. Group by project
    const projectsMap = new Map();

    mergedData.forEach((item) => {
      const { projectId, materialTypeId, quantityUsed, totalCost } = item;

      if (!projectsMap.has(projectId)) {
        projectsMap.set(projectId, {
          projectId,
          projectName: projectMap.get(projectId) || projectId,
          totals: {
            quantityUsed: 0,
            totalCost: 0,
            totalCostK: 0,
            costPerUnit: null,
          },
          byMaterialType: [],
        });
      }

      const project = projectsMap.get(projectId);
      const materialInfo = materialTypeMap.get(materialTypeId) || {
        name: materialTypeId,
        unit: '',
      };

      // Calculate material-level values
      const materialTotalCostK = calculateTotalCostK(totalCost);
      const materialCostPerUnit = calculateCostPerUnit(totalCost, quantityUsed);

      // Create material type object
      const materialTypeObj = {
        materialTypeId,
        materialTypeName: materialInfo.name,
        unit: materialInfo.unit,
        quantityUsed: quantityUsed || 0,
        totalCost: totalCost || 0,
        totalCostK: materialTotalCostK,
        costPerUnit: materialCostPerUnit,
      };

      project.byMaterialType.push(materialTypeObj);

      // Add to project totals
      project.totals.quantityUsed += quantityUsed || 0;
      project.totals.totalCost += totalCost || 0;
    });

    // 4. Compute project-level totals
    projectsMap.forEach((project) => {
      const { quantityUsed, totalCost } = project.totals;
      project.totals.totalCostK = calculateTotalCostK(totalCost);
      project.totals.costPerUnit = calculateCostPerUnit(totalCost, quantityUsed);
    });

    // 5. Handle projects with explicit selection but no data
    if (projectIds && projectIds.length > 0) {
      projectIds.forEach((projectIdStr) => {
        const idStr = String(projectIdStr);
        if (!projectsMap.has(idStr)) {
          projectsMap.set(idStr, {
            projectId: idStr,
            projectName: projectMap.get(idStr) || idStr,
            totals: {
              quantityUsed: 0,
              totalCost: 0,
              totalCostK: 0,
              costPerUnit: null,
            },
            byMaterialType: [],
          });
        }
      });
    }

    // 6. Sort projects by name
    const projectsArray = Array.from(projectsMap.values()).sort((a, b) => {
      const nameA = (a.projectName || '').toLowerCase();
      const nameB = (b.projectName || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });

    // 7. Build meta object
    const meta = {
      request: {
        projectIds: projectIds || [],
        materialTypeIds: materialTypeIds || [],
        startDateInput: dateRangeMeta?.originalInputs?.startDateInput,
        endDateInput: dateRangeMeta?.originalInputs?.endDateInput,
      },
      range: {
        effectiveStart: dateRangeMeta?.effectiveStart?.toISOString(),
        effectiveEnd: dateRangeMeta?.effectiveEnd?.toISOString(),
        endCappedToNowMinus5Min: dateRangeMeta?.endCappedToNowMinus5Min || false,
        defaultsApplied: dateRangeMeta?.defaultsApplied || {
          startDate: false,
          endDate: false,
        },
      },
      units: {
        currency: 'USD',
        costScale: {
          raw: 1,
          k: 1000,
        },
      },
    };

    // 8. Assemble final response
    return {
      meta,
      data: projectsArray,
    };
  } catch (error) {
    logger.logException(error, 'buildCostCorrelationResponse', {
      usageDataLength: usageData?.length,
      costDataLength: costData?.length,
    });
    // Return empty response structure on error
    return {
      meta: {
        request: {
          projectIds: projectIds || [],
          materialTypeIds: materialTypeIds || [],
          startDateInput: dateRangeMeta?.originalInputs?.startDateInput,
          endDateInput: dateRangeMeta?.originalInputs?.endDateInput,
        },
        range: {
          effectiveStart: dateRangeMeta?.effectiveStart?.toISOString(),
          effectiveEnd: dateRangeMeta?.effectiveEnd?.toISOString(),
          endCappedToNowMinus5Min: dateRangeMeta?.endCappedToNowMinus5Min || false,
          defaultsApplied: dateRangeMeta?.defaultsApplied || {
            startDate: false,
            endDate: false,
          },
        },
        units: {
          currency: 'USD',
          costScale: {
            raw: 1,
            k: COST_SCALE_K,
          },
        },
      },
      data: [],
    };
  }
}

module.exports = {
  getEarliestRelevantMaterialDate,
  aggregateMaterialUsage,
  aggregateMaterialCost,
  buildCostCorrelationResponse,
  buildBaseMatchForMaterials, // Export for testing/reuse
};
