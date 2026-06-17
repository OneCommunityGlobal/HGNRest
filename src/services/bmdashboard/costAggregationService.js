const mongoose = require('mongoose');
const Cost = require('../../models/costs');
const { COST_CATEGORIES, DEFAULT_HOURLY_RATE } = require('../../models/costs');
const BuildingProject = require('../../models/bmdashboard/buildingProject');
const BuildingMaterial = require('../../models/bmdashboard/buildingMaterial');
const BuildingTool = require('../../models/bmdashboard/buildingTool');
const logger = require('../../startup/logger');

/**
 * Calculates labor cost for a building project from member hours.
 * Aligned with bmFinancialController.calculateLaborCost logic.
 *
 * @param {Object} project - Building project document with members array
 * @param {number} [hourlyRate] - Hourly rate for labor cost calculation
 * @returns {number} Total labor cost
 */
function calculateProjectLaborCost(project, hourlyRate = DEFAULT_HOURLY_RATE) {
  if (!project || !Array.isArray(project.members)) return 0;

  return project.members.reduce((total, member) => {
    const hoursWorked = member.hours || 0;
    return total + hoursWorked * hourlyRate;
  }, 0);
}

/**
 * Extracts approved purchase records grouped by date from inventory documents.
 * Used for both materials and tools/equipment.
 *
 * @param {Array} inventoryDocs - Array of buildingMaterial or buildingTool documents
 * @returns {Map<string, number>} Map of ISO date string → summed cost for that date
 */
function aggregateApprovedPurchasesByDate(inventoryDocs) {
  const costsByDate = new Map();

  inventoryDocs.forEach((doc) => {
    if (!Array.isArray(doc.purchaseRecord)) return;

    doc.purchaseRecord.forEach((record) => {
      const status = (record.status || '').trim().toLowerCase();
      if (status !== 'approved') return;

      const quantity = record.quantity || 0;
      const unitPrice = record.unitPrice || 0;
      const amount = quantity * unitPrice;

      if (amount <= 0) return;

      const costDate = record.date ? new Date(record.date) : new Date();
      const dateKey = costDate.toISOString().split('T')[0];

      costsByDate.set(dateKey, (costsByDate.get(dateKey) || 0) + amount);
    });
  });

  return costsByDate;
}

/**
 * Builds bulk upsert operations for a given category's cost-by-date map.
 *
 * @param {Object} projectInfo - Project metadata
 * @param {ObjectId} projectInfo.projectId - Building project ID
 * @param {string} projectInfo.projectName - Building project name
 * @param {string} projectInfo.projectType - Building project type
 * @param {string} category - One of COST_CATEGORIES
 * @param {Map<string, number>} costsByDate - Map of date string → amount
 * @returns {Array} Array of bulkWrite updateOne operations
 */
function buildUpsertOps(projectInfo, category, costsByDate) {
  const { projectId, projectName, projectType } = projectInfo;
  const ops = [];
  const now = new Date();

  costsByDate.forEach((amount, dateKey) => {
    ops.push({
      updateOne: {
        filter: {
          projectId,
          category,
          costDate: new Date(dateKey),
        },
        update: {
          $set: {
            amount,
            projectName,
            projectType: projectType || 'private',
            lastUpdated: now,
            calculatedAt: now,
            source: 'aggregation',
          },
        },
        upsert: true,
      },
    });
  });

  return ops;
}

/**
 * Runs cost aggregation for one or more building projects.
 * Reads from BuildingProject, BuildingMaterial, BuildingTool and writes
 * materialized Cost documents using upsert by (projectId, category, costDate).
 *
 * @param {Array<ObjectId|string>} [projectIds] - Specific project IDs to aggregate. If omitted, aggregates all.
 * @returns {Promise<{updated: number, errors: Array}>}
 */
async function runCostAggregation(projectIds) {
  const result = { updated: 0, errors: [] };

  try {
    let projects;
    if (projectIds && projectIds.length > 0) {
      const objectIds = projectIds.map((id) =>
        typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id,
      );
      projects = await BuildingProject.find({ _id: { $in: objectIds } });
    } else {
      projects = await BuildingProject.find({});
    }

    if (!projects.length) {
      return result;
    }

    const aggregationPromises = projects.map(async (project) => {
      const projectOps = [];
      const projectId = project._id;
      const projectName = project.name || 'Unnamed Project';
      const projectType = project.projectType || 'private';

      try {
        // --- Labor ---
        const laborCost = calculateProjectLaborCost(project);
        if (laborCost > 0) {
          const laborDate = project.dateCreated || project.createdAt || new Date();
          const laborDateKey = new Date(laborDate).toISOString().split('T')[0];
          const laborCostsByDate = new Map([[laborDateKey, laborCost]]);
          projectOps.push(
            ...buildUpsertOps(
              { projectId, projectName, projectType },
              COST_CATEGORIES[0], // 'Total Cost of Labor'
              laborCostsByDate,
            ),
          );
        }

        // --- Materials ---
        const materials = await BuildingMaterial.find({ project: projectId });
        const materialCostsByDate = aggregateApprovedPurchasesByDate(materials);
        if (materialCostsByDate.size > 0) {
          projectOps.push(
            ...buildUpsertOps(
              { projectId, projectName, projectType },
              COST_CATEGORIES[1], // 'Total Cost of Materials'
              materialCostsByDate,
            ),
          );
        }

        // --- Equipment (Tools) ---
        const tools = await BuildingTool.find({ project: projectId });
        const toolCostsByDate = aggregateApprovedPurchasesByDate(tools);
        if (toolCostsByDate.size > 0) {
          projectOps.push(
            ...buildUpsertOps(
              { projectId, projectName, projectType },
              COST_CATEGORIES[2], // 'Total Cost of Equipment'
              toolCostsByDate,
            ),
          );
        }

        // Execute bulk write for this project
        if (projectOps.length > 0) {
          const writeResult = await Cost.bulkWrite(projectOps, { ordered: false });
          result.updated += writeResult.upsertedCount + writeResult.modifiedCount;
        }
      } catch (err) {
        const errorMsg = `Aggregation failed for project ${projectId}: ${err.message}`;
        logger.logException(err, 'costAggregationService.runCostAggregation', {
          projectId: projectId.toString(),
        });
        result.errors.push(errorMsg);
      }
    });

    await Promise.all(aggregationPromises);
  } catch (err) {
    logger.logException(err, 'costAggregationService.runCostAggregation');
    result.errors.push(`Aggregation failed: ${err.message}`);
  }

  return result;
}

/**
 * Debounce map: projectId string → timeout handle.
 * Prevents rapid repeated aggregation for the same project.
 */
const debounceTimers = new Map();
const DEBOUNCE_DELAY_MS = 30000;

/**
 * Triggers cost aggregation for a single project with debouncing.
 * Multiple rapid calls for the same project are collapsed into one execution.
 *
 * @param {ObjectId|string} projectId - The building project ID to aggregate
 */
function triggerProjectAggregation(projectId) {
  const key = projectId.toString();

  if (debounceTimers.has(key)) {
    clearTimeout(debounceTimers.get(key));
  }

  const timer = setTimeout(async () => {
    debounceTimers.delete(key);
    try {
      await runCostAggregation([projectId]);
    } catch (err) {
      logger.logException(err, 'costAggregationService.triggerProjectAggregation', {
        projectId: key,
      });
    }
  }, DEBOUNCE_DELAY_MS);

  debounceTimers.set(key, timer);
}

module.exports = {
  runCostAggregation,
  triggerProjectAggregation,
};
