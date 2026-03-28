const mongoose = require('mongoose');

const bmToolsReturnedLateController = function () {
  const ToolReturn = require('../../models/bmdashboard/toolReturn');

  const parseDate = (d) => (d ? new Date(d) : null);

  const getToolsReturnedLate = async (req, res) => {
    try {
      const { projectId, startDate, endDate, tools } = req.query;
      console.log('Tools Returned Late Query:', { projectId, startDate, endDate, tools });
      const start = parseDate(startDate);
      const end = parseDate(endDate);
      const matchFilter = {};
      if (projectId && projectId !== 'All') {
        matchFilter.projectId = new mongoose.Types.ObjectId(projectId);
      }
      if (start || end) {
        matchFilter.date = {};
        if (start) matchFilter.date.$gte = start;
        if (end) matchFilter.date.$lte = end;
      }
      if (tools) {
        const toolList = String(tools)
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);
        if (toolList.length > 0) {
          matchFilter.toolName = { $in: toolList };
        }
      }
      const toolData = await ToolReturn.find(matchFilter).lean();
      if (toolData.length === 0) {
        return res.status(200).json({
          success: true,
          count: 0,
          data: [],
          message: 'No tool return data found for the specified criteria.',
        });
      }
      const toolStats = {};
      toolData.forEach((record) => {
        const { toolName } = record;
        if (!toolStats[toolName]) {
          toolStats[toolName] = {
            totalReturns: 0,
            lateReturns: 0,
          };
        }
        toolStats[toolName].totalReturns += record.totalReturns;
        toolStats[toolName].lateReturns += record.returnedLate;
      });
      const results = Object.entries(toolStats).map(([toolName, stats]) => ({
        toolName,
        percentLate:
          stats.totalReturns > 0 ? Math.round((stats.lateReturns / stats.totalReturns) * 100) : 0,
      }));
      results.sort((a, b) => b.percentLate - a.percentLate);
      res.status(200).json({
        success: true,
        count: results.length,
        data: results,
        message:
          results.length > 0
            ? `Found ${results.length} tools with rental data`
            : 'No tools found with the specified criteria',
      });
    } catch (err) {
      res.status(500).json({ success: false, error: `Server error ${err.message}` });
    }
  };

  const getAvailableProjects = async (req, res) => {
    try {
      const projects = await ToolReturn.distinct('projectId');
      res.status(200).json({
        success: true,
        data: projects.map((id, index) => ({
          projectId: id.toString(),
          projectName: `Project ${index + 1}`,
        })),
      });
    } catch (err) {
      res.status(500).json({ success: false, error: `Server error ${err.message}` });
    }
  };

  return {
    getToolsReturnedLate,
    getAvailableProjects,
  };
};

module.exports = bmToolsReturnedLateController;
