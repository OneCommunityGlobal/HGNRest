const logger = require('../../startup/logger');
const {
  FORECAST_MODES,
  VALID_FORECAST_MODES,
  REPORT_FORMATS,
} = require('../../constants/toolUtilization');
const {
  computeUtilizationData,
  buildUtilizationResponse,
  generateRecommendations,
  generateMaintenanceAlerts,
  generateResourceBalancingSuggestions,
  buildInsightsSummary,
  buildReportPayload,
} = require('../../helpers/toolUtilizationHelpers');
const {
  generatePDFReport,
  generateCSVReport,
} = require('../../helpers/toolUtilizationReportHelpers');

const toolUtilizationController = function (BuildingTool) {
  const getUtilization = async (req, res) => {
    try {
      const { tool, project, startDate, endDate, mode } = req.query;
      const selectedMode = mode || FORECAST_MODES.HISTORICAL;

      if (mode && !VALID_FORECAST_MODES.includes(selectedMode)) {
        return res.status(400).json({
          error: `Invalid mode. Must be one of: ${VALID_FORECAST_MODES.join(', ')}`,
        });
      }

      if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
        return res.status(400).json({ error: 'startDate cannot be after endDate.' });
      }

      const { utilizationData, rangeStart, rangeEnd } = await computeUtilizationData(BuildingTool, {
        tool,
        project,
        startDate,
        endDate,
      });

      const responseData = await buildUtilizationResponse({
        utilizationData,
        rangeStart,
        rangeEnd,
        selectedMode,
        project,
      });

      return res.status(200).json(responseData);
    } catch (err) {
      logger.logException(err, 'toolUtilizationController.getUtilization');
      return res.status(500).json({ error: `Server error: ${err.message}` });
    }
  };

  const getInsights = async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
        return res.status(400).json({ error: 'startDate cannot be after endDate.' });
      }

      const { utilizationData } = await computeUtilizationData(BuildingTool, req.query);

      return res.status(200).json({
        recommendations: generateRecommendations(utilizationData),
        maintenanceAlerts: generateMaintenanceAlerts(utilizationData),
        resourceBalancing: generateResourceBalancingSuggestions(utilizationData),
        summary: buildInsightsSummary(utilizationData),
      });
    } catch (err) {
      logger.logException(err, 'toolUtilizationController.getInsights');
      return res.status(500).json({ error: `Server error: ${err.message}` });
    }
  };

  const exportReport = async (req, res) => {
    try {
      const { format, startDate, endDate } = req.query;

      if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
        return res.status(400).json({ error: 'startDate cannot be after endDate.' });
      }

      if (!format || !REPORT_FORMATS.includes(format)) {
        return res.status(400).json({
          error: `Invalid format. Must be one of: ${REPORT_FORMATS.join(', ')}`,
        });
      }

      const { utilizationData, rangeStart, rangeEnd } = await computeUtilizationData(
        BuildingTool,
        req.query,
      );
      const reportPayload = buildReportPayload(
        utilizationData,
        rangeStart,
        rangeEnd,
        req.query.project,
      );

      if (format === 'pdf') {
        generatePDFReport(res, reportPayload);
      } else {
        generateCSVReport(res, reportPayload);
      }
    } catch (err) {
      logger.logException(err, 'toolUtilizationController.exportReport');
      if (!res.headersSent) {
        return res.status(500).json({ error: `Server error: ${err.message}` });
      }
    }
    return undefined;
  };

  return {
    getUtilization,
    getInsights,
    exportReport,
  };
};

module.exports = toolUtilizationController;
