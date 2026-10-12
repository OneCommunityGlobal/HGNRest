/**
 * Material Insights Handlers
 * API endpoint handlers for material insights
 */

const mongoose = require('mongoose');
const {
  calculateMaterialInsights,
  calculateSummaryMetrics,
} = require('./materialInsightsCalculations');

const createUtilities = (BuildingMaterial) => {
  const fetchMaterials = (query = {}) =>
    BuildingMaterial.find(query)
      .populate([
        { path: 'project', select: '_id name' },
        { path: 'itemType', select: '_id name unit' },
      ])
      .lean()
      .exec();

  const handleError = (res, error, endpoint) => {
    console.error(`Error ${endpoint}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
    });
  };

  const sendSuccessResponse = (res, data, status = 200) =>
    res.status(status).json({ success: true, data });

  const sendErrorResponse = (res, message, status = 400) =>
    res.status(status).json({ success: false, message });

  const validateObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

  return { fetchMaterials, handleError, sendSuccessResponse, sendErrorResponse, validateObjectId };
};

const createAllMaterialsHandler = (BuildingMaterial, utils) => async (req, res) => {
  try {
    const materials = await utils.fetchMaterials();
    const materialInsights = materials.map((m) => calculateMaterialInsights(m));
    const summaryMetrics = calculateSummaryMetrics(materials);
    return utils.sendSuccessResponse(res, {
      materials: materialInsights,
      summary: summaryMetrics,
      timestamp: new Date(),
    });
  } catch (error) {
    return utils.handleError(res, error, 'fetching material insights');
  }
};

const createProjectMaterialsHandler = (BuildingMaterial, utils) => async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!utils.validateObjectId(projectId)) {
      return utils.sendErrorResponse(res, 'Invalid project ID');
    }

    const materials = await utils.fetchMaterials({ project: projectId });
    const materialInsights = materials.map((m) => calculateMaterialInsights(m));
    const summaryMetrics = calculateSummaryMetrics(materials);
    return utils.sendSuccessResponse(res, {
      projectId,
      materials: materialInsights,
      summary: summaryMetrics,
      timestamp: new Date(),
    });
  } catch (error) {
    return utils.handleError(res, error, 'fetching material insights by project');
  }
};

const createSummaryHandler = (BuildingMaterial, utils) => async (req, res) => {
  try {
    const materials = await BuildingMaterial.find().lean().exec();
    const summaryMetrics = calculateSummaryMetrics(materials);
    return utils.sendSuccessResponse(res, {
      ...summaryMetrics,
      timestamp: new Date(),
    });
  } catch (error) {
    return utils.handleError(res, error, 'fetching summary metrics');
  }
};

const createProjectSummaryHandler = (BuildingMaterial, utils) => async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!utils.validateObjectId(projectId)) {
      return utils.sendErrorResponse(res, 'Invalid project ID');
    }

    const materials = await BuildingMaterial.find({ project: projectId }).lean().exec();
    const summaryMetrics = calculateSummaryMetrics(materials);
    return utils.sendSuccessResponse(res, {
      projectId,
      ...summaryMetrics,
      timestamp: new Date(),
    });
  } catch (error) {
    return utils.handleError(res, error, 'fetching summary metrics by project');
  }
};

const createCriticalItemsHandler = (BuildingMaterial, utils) => async (req, res) => {
  try {
    const materials = await utils.fetchMaterials();
    const criticalItems = materials
      .map((m) => calculateMaterialInsights(m))
      .filter((i) => i.stockHealth === 'critical' || i.stockHealth === 'low')
      .sort((a, b) => {
        if (a.stockRatio === null) return 1;
        if (b.stockRatio === null) return -1;
        return a.stockRatio - b.stockRatio;
      });

    return utils.sendSuccessResponse(res, {
      criticalItemCount: criticalItems.length,
      items: criticalItems,
      timestamp: new Date(),
    });
  } catch (error) {
    return utils.handleError(res, error, 'fetching critical stock items');
  }
};

const createHighUsageHandler = (BuildingMaterial, utils) => async (req, res) => {
  try {
    const materials = await utils.fetchMaterials();
    const highUsageItems = materials
      .map((m) => calculateMaterialInsights(m))
      .filter((i) => i.usagePct !== null && i.usagePct >= 80)
      .sort((a, b) => (b.usagePct || 0) - (a.usagePct || 0));

    return utils.sendSuccessResponse(res, {
      highUsageItemCount: highUsageItems.length,
      items: highUsageItems,
      timestamp: new Date(),
    });
  } catch (error) {
    return utils.handleError(res, error, 'fetching high usage items');
  }
};

const createDetailHandler = (BuildingMaterial, utils) => async (req, res) => {
  try {
    const { materialId } = req.params;
    if (!utils.validateObjectId(materialId)) {
      return utils.sendErrorResponse(res, 'Invalid material ID');
    }

    const material = await BuildingMaterial.findById(materialId)
      .populate([
        { path: 'project', select: '_id name' },
        { path: 'itemType', select: '_id name unit' },
      ])
      .lean()
      .exec();

    if (!material) {
      return utils.sendErrorResponse(res, 'Material not found', 404);
    }

    const insights = calculateMaterialInsights(material);
    return utils.sendSuccessResponse(res, {
      ...insights,
      timestamp: new Date(),
    });
  } catch (error) {
    return utils.handleError(res, error, 'fetching material insights detail');
  }
};

const createHandlers = (BuildingMaterial) => {
  const utils = createUtilities(BuildingMaterial);

  return {
    getMaterialInsightsAll: createAllMaterialsHandler(BuildingMaterial, utils),
    getMaterialInsightsByProject: createProjectMaterialsHandler(BuildingMaterial, utils),
    getSummaryMetrics: createSummaryHandler(BuildingMaterial, utils),
    getSummaryMetricsByProject: createProjectSummaryHandler(BuildingMaterial, utils),
    getCriticalStockItems: createCriticalItemsHandler(BuildingMaterial, utils),
    getHighUsageItems: createHighUsageHandler(BuildingMaterial, utils),
    getMaterialInsightsDetail: createDetailHandler(BuildingMaterial, utils),
  };
};

module.exports = createHandlers;
