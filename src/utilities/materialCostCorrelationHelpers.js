/**
 * Material Cost Correlation Helper Utilities
 *
 * Centralizes MongoDB aggregation logic for material usage and cost calculations.
 * Prevents duplication between similar aggregation patterns and makes code testable.
 */

const mongoose = require('mongoose');
const logger = require('../startup/logger');

/**
 * Resolve project names to ObjectIds by querying the BuildingProject model.
 *
 * @param {string[]} projectNames - Array of project names to resolve
 * @param {Object} BuildingProject - Mongoose model for BuildingProject
 * @returns {Promise<string[]>} Array of ObjectId strings
 * @throws {Object} Structured error object with type 'NAME_RESOLUTION_ERROR' if names not found
 */
async function resolveProjectNamesToIds(projectNames, BuildingProject) {
  if (!projectNames || projectNames.length === 0) {
    return [];
  }

  try {
    // Query projects by name (case-insensitive, exact match)
    const projects = await BuildingProject.find({
      name: { $in: projectNames },
      isActive: true, // Only active projects
    })
      .select('_id name')
      .exec();

    // Create a map of name (lowercase) to ObjectId
    const nameToIdMap = new Map();
    projects.forEach((project) => {
      if (project.name) {
        nameToIdMap.set(project.name.toLowerCase(), project._id.toString());
      }
    });

    // Check for missing names
    const missingNames = [];
    const resolvedIds = [];

    projectNames.forEach((name) => {
      const normalizedName = name.trim().toLowerCase();
      const id = nameToIdMap.get(normalizedName);

      if (id) {
        resolvedIds.push(id);
      } else {
        missingNames.push(name);
      }
    });

    // If any names were not found, throw error
    if (missingNames.length > 0) {
      const error = {
        type: 'NAME_RESOLUTION_ERROR',
        message: `The following project names were not found: ${missingNames.join(', ')}`,
        missingNames,
        paramName: 'projectName',
      };
      throw error;
    }

    return resolvedIds;
  } catch (error) {
    // Re-throw if it's already a structured error
    if (error.type === 'NAME_RESOLUTION_ERROR') {
      throw error;
    }

    // Wrap database errors
    logger.logException(error, 'resolveProjectNamesToIds - database query', {
      projectNamesCount: projectNames.length,
    });

    const dbError = {
      type: 'NAME_RESOLUTION_ERROR',
      message: 'Error resolving project names. Please try again or use projectId instead.',
      paramName: 'projectName',
    };
    throw dbError;
  }
}

/**
 * Resolve material type names to ObjectIds by querying the BuildingInventoryType model.
 *
 * @param {string[]} materialNames - Array of material type names to resolve
 * @param {Object} BuildingInventoryType - Mongoose model for BuildingInventoryType
 * @returns {Promise<string[]>} Array of ObjectId strings
 * @throws {Object} Structured error object with type 'NAME_RESOLUTION_ERROR' if names not found
 */
async function resolveMaterialNamesToIds(materialNames, BuildingInventoryType) {
  if (!materialNames || materialNames.length === 0) {
    return [];
  }

  try {
    // Query material types by name (case-insensitive, exact match)
    const materials = await BuildingInventoryType.find({
      name: { $in: materialNames },
    })
      .select('_id name')
      .exec();

    // Create a map of name (lowercase) to ObjectId
    const nameToIdMap = new Map();
    materials.forEach((material) => {
      if (material.name) {
        nameToIdMap.set(material.name.toLowerCase(), material._id.toString());
      }
    });

    // Check for missing names
    const missingNames = [];
    const resolvedIds = [];

    materialNames.forEach((name) => {
      const normalizedName = name.trim().toLowerCase();
      const id = nameToIdMap.get(normalizedName);

      if (id) {
        resolvedIds.push(id);
      } else {
        missingNames.push(name);
      }
    });

    // If any names were not found, throw error
    if (missingNames.length > 0) {
      const error = {
        type: 'NAME_RESOLUTION_ERROR',
        message: `The following material type names were not found: ${missingNames.join(', ')}`,
        missingNames,
        paramName: 'materialName',
      };
      throw error;
    }

    return resolvedIds;
  } catch (error) {
    // Re-throw if it's already a structured error
    if (error.type === 'NAME_RESOLUTION_ERROR') {
      throw error;
    }

    // Wrap database errors
    logger.logException(error, 'resolveMaterialNamesToIds - database query', {
      materialNamesCount: materialNames.length,
    });

    const dbError = {
      type: 'NAME_RESOLUTION_ERROR',
      message: 'Error resolving material type names. Please try again or use materialType instead.',
      paramName: 'materialName',
    };
    throw dbError;
  }
}

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

    // Convert string IDs to ObjectIds
    let projectObjectIds = [];
    if (projectIds && projectIds.length > 0) {
      projectObjectIds = convertStringsToObjectIds(projectIds);
    }

    let materialTypeObjectIds = [];
    if (materialTypeIds && materialTypeIds.length > 0) {
      materialTypeObjectIds = convertStringsToObjectIds(materialTypeIds);
    }

    // Build base match with ObjectIds
    const baseMatch = {};
    if (projectObjectIds.length > 0) {
      baseMatch.project = { $in: projectObjectIds };
    }
    if (materialTypeObjectIds.length > 0) {
      baseMatch.itemType = { $in: materialTypeObjectIds };
    }

    // Create aggregation pipeline
    const pipeline = [
      // Stage 1: Match by project/material filters
      { $match: baseMatch },
      // Stage 2: Unwind purchaseRecord array
      { $unwind: '$purchaseRecord' },
      // Stage 3: Filter purchaseRecords by status and date range
      {
        $match: {
          'purchaseRecord.status': 'Approved',
          'purchaseRecord.date': {
            $exists: true,
            $ne: null,
            $gte: effectiveStart,
            $lte: effectiveEnd,
          },
          'purchaseRecord.quantity': { $exists: true, $ne: null, $type: 'number', $gt: 0 },
        },
      },
      // Stage 3.5: Ensure unitPrice is a number (preserve existing, convert strings, default missing)
      {
        $addFields: {
          'purchaseRecord.unitPrice': {
            $toDouble: { $ifNull: ['$purchaseRecord.unitPrice', 0] },
          },
        },
      },
      // Stage 3.6: Filter to only include records with valid unitPrice (>= 0)
      {
        $match: {
          'purchaseRecord.unitPrice': { $type: 'number', $gte: 0 },
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

    // Execute aggregation
    const results = await BuildingMaterial.aggregate(pipeline).exec();

    return results;
  } catch (error) {
    console.error(`[aggregateMaterialCost] ❌ Error:`, error.message);
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
 * Build lookup maps for project and material type names/units.
 *
 * @param {Set} projectIdSet - Set of project ID strings
 * @param {Set} materialTypeIdSet - Set of material type ID strings
 * @param {Object} BuildingProject - Mongoose model for projects
 * @param {Object} BuildingInventoryType - Mongoose model for inventory types
 * @returns {Promise<{projectMap: Map, materialTypeMap: Map}>} Maps for project and material type lookups
 */
async function buildLookupMaps(
  projectIdSet,
  materialTypeIdSet,
  BuildingProject,
  BuildingInventoryType,
) {
  const allUniqueProjectIds = convertStringsToObjectIds(Array.from(projectIdSet));
  const allUniqueMaterialTypeIds = convertStringsToObjectIds(Array.from(materialTypeIdSet));

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

    projects.forEach((project) => {
      const idStr = objectIdToString(project._id);
      projectMap.set(idStr, project.name || idStr);
    });

    materialTypes.forEach((material) => {
      const idStr = objectIdToString(material._id);
      materialTypeMap.set(idStr, {
        name: material.name || idStr,
        unit: material.unit || '',
      });
    });
  } catch (lookupError) {
    logger.logException(lookupError, 'buildLookupMaps - lookup queries', {
      projectIds: allUniqueProjectIds.length,
      materialTypeIds: allUniqueMaterialTypeIds.length,
    });
  }

  return { projectMap, materialTypeMap };
}

/**
 * Merge usage and cost data by composite key.
 *
 * @param {Array} usageData - Array from aggregateMaterialUsage
 * @param {Array} costData - Array from aggregateMaterialCost
 * @returns {Map} Merged data map keyed by projectId-materialTypeId
 */
function mergeUsageAndCostData(usageData, costData) {
  const mergedData = new Map();

  // Process usage data
  if (usageData && Array.isArray(usageData)) {
    usageData.forEach((item) => {
      if (!item || !item.projectId || !item.materialTypeId) return;

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
  }

  // Process cost data
  if (costData && Array.isArray(costData)) {
    costData.forEach((item) => {
      if (!item || !item.projectId || !item.materialTypeId) {
        return;
      }

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

      // Extract and validate cost value
      const cost =
        typeof item.totalCost === 'number' && !Number.isNaN(item.totalCost)
          ? item.totalCost
          : parseFloat(item.totalCost) || 0;

      // Ensure we're setting a valid number
      const existingEntry = mergedData.get(key);
      existingEntry.totalCost = typeof cost === 'number' && !Number.isNaN(cost) ? cost : 0;
    });
  }

  return mergedData;
}

/**
 * Build projects map from merged data.
 *
 * @param {Map} mergedData - Merged usage and cost data
 * @param {Map} projectMap - Project name lookup map
 * @param {Map} materialTypeMap - Material type info lookup map
 * @returns {Map} Projects map keyed by project ID
 */
function buildProjectsMap(mergedData, projectMap, materialTypeMap) {
  const projectsMap = new Map();

  mergedData.forEach((item, key) => {
    // Explicit validation: Ensure item is valid
    if (!item || typeof item !== 'object') {
      return;
    }

    const { projectId, materialTypeId, quantityUsed, totalCost } = item;

    // Ensure projectId and materialTypeId are strings for consistent key matching
    const projectIdStr = objectIdToString(projectId);
    const materialTypeIdStr = objectIdToString(materialTypeId);

    if (!projectsMap.has(projectIdStr)) {
      projectsMap.set(projectIdStr, {
        projectId: projectIdStr,
        projectName: projectMap.get(projectIdStr) || projectIdStr,
        totals: {
          quantityUsed: 0,
          totalCost: 0,
          totalCostK: 0,
          costPerUnit: null,
        },
        byMaterialType: [],
      });
    }

    const project = projectsMap.get(projectIdStr);
    const materialInfo = materialTypeMap.get(materialTypeIdStr) || {
      name: materialTypeIdStr,
      unit: '',
    };

    // Ensure totalCost is a number before calculations
    const safeTotalCost = typeof totalCost === 'number' && !Number.isNaN(totalCost) ? totalCost : 0;

    const materialTotalCostK = calculateTotalCostK(safeTotalCost);
    const materialCostPerUnit = calculateCostPerUnit(safeTotalCost, quantityUsed);

    const materialTypeObj = {
      materialTypeId: materialTypeIdStr,
      materialTypeName: materialInfo.name,
      unit: materialInfo.unit,
      quantityUsed: quantityUsed || 0,
      totalCost: safeTotalCost,
      totalCostK: materialTotalCostK,
      costPerUnit: materialCostPerUnit,
    };

    project.byMaterialType.push(materialTypeObj);
    project.totals.quantityUsed += quantityUsed || 0;
    project.totals.totalCost += safeTotalCost;
  });

  // Compute project-level totals
  projectsMap.forEach((project) => {
    const { quantityUsed, totalCost } = project.totals;
    project.totals.totalCostK = calculateTotalCostK(totalCost);
    project.totals.costPerUnit = calculateCostPerUnit(totalCost, quantityUsed);
  });

  return projectsMap;
}

/**
 * Build meta object for response.
 *
 * @param {string[]} projectIds - Project IDs
 * @param {string[]} materialTypeIds - Material type IDs
 * @param {Object} dateRangeMeta - Date range metadata
 * @returns {Object} Meta object
 */
function buildMetaObject(projectIds, materialTypeIds, dateRangeMeta) {
  return {
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
async function buildCostCorrelationResponse(usageData, costData, requestParams, models) {
  const { projectIds, materialTypeIds, dateRangeMeta } = requestParams;
  const { BuildingProject, BuildingInventoryType } = models;
  try {
    // 1. Collect unique IDs from usage and cost data
    const projectIdSet = new Set();
    const materialTypeIdSet = new Set();

    [...usageData, ...costData].forEach((item) => {
      if (item?.projectId) {
        projectIdSet.add(objectIdToString(item.projectId));
      }
      if (item?.materialTypeId) {
        materialTypeIdSet.add(objectIdToString(item.materialTypeId));
      }
    });

    // Include explicitly requested IDs
    projectIds.forEach((id) => projectIdSet.add(String(id)));
    materialTypeIds.forEach((id) => materialTypeIdSet.add(String(id)));

    // 2. Build lookup maps
    const { projectMap, materialTypeMap } = await buildLookupMaps(
      projectIdSet,
      materialTypeIdSet,
      BuildingProject,
      BuildingInventoryType,
    );

    // 3. Merge usage and cost data
    const mergedData = mergeUsageAndCostData(usageData, costData);

    // 4. Build projects map
    const projectsMap = buildProjectsMap(mergedData, projectMap, materialTypeMap);

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

    // 6. Sort and build response
    const projectsArray = Array.from(projectsMap.values()).sort((a, b) => {
      const nameA = (a.projectName || '').toLowerCase();
      const nameB = (b.projectName || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });

    const meta = buildMetaObject(projectIds, materialTypeIds, dateRangeMeta);

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
    const meta = buildMetaObject(projectIds, materialTypeIds, dateRangeMeta);
    return {
      meta,
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
  convertStringsToObjectIds, // Export for testing
  calculateCostPerUnit, // Export for testing
  calculateTotalCostK, // Export for testing
  objectIdToString, // Export for testing
  resolveProjectNamesToIds, // Export for name resolution
  resolveMaterialNamesToIds, // Export for name resolution
};
