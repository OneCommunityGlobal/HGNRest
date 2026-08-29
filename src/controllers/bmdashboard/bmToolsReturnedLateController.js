const mongoose = require('mongoose');

const bmToolsReturnedLateController = function () {
  const ToolReturn = require('../../models/bmdashboard/toolReturn');
  const Project = require('../../models/project');

  const getSingleQueryValue = (value) => {
    if (value === undefined || value === null || value === '') return null;
    return typeof value === 'string' ? value.trim() : null;
  };

  const parseDate = (value) => {
    const dateValue = getSingleQueryValue(value);
    if (!dateValue) return null;

    const parsedDate = new Date(dateValue);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  };

  const parseTools = (value) => {
    const toolsValue = getSingleQueryValue(value);
    if (!toolsValue) return [];

    return toolsValue
      .split(',')
      .map((toolName) => toolName.trim())
      .filter(Boolean);
  };

  const getProjectNameMap = async (projectIds) => {
    const projectDocs = await Project.find({ _id: { $in: projectIds } }, '_id projectName').lean();
    const projectNameById = projectDocs.reduce((acc, project) => {
      acc[project._id.toString()] = project.projectName;
      return acc;
    }, {});

    projectIds.forEach((currentProjectId, index) => {
      if (!projectNameById[currentProjectId]) {
        projectNameById[currentProjectId] = `Project ${index + 1}`;
      }
    });

    return projectNameById;
  };

  const buildToolStats = (toolData, projectNameById) => {
    const toolStats = {};

    toolData.forEach((record) => {
      const projectIdValue = record.projectId?.toString() || '';
      const statKey = projectIdValue
        ? `${record.toolName}::${projectIdValue}`
        : `${record.toolName}::ALL`;

      if (!toolStats[statKey]) {
        toolStats[statKey] = {
          toolName: record.toolName,
          projectId: projectIdValue,
          projectName: projectNameById[projectIdValue] || '',
          totalReturns: 0,
          lateReturns: 0,
        };
      }

      toolStats[statKey].totalReturns += record.totalReturns;
      toolStats[statKey].lateReturns += record.returnedLate;
    });

    return Object.values(toolStats)
      .map((stats) => ({
        toolName: stats.toolName,
        projectId: stats.projectId,
        projectName: stats.projectName,
        totalReturns: stats.totalReturns,
        lateReturns: stats.lateReturns,
        percentLate:
          stats.totalReturns > 0 ? Math.round((stats.lateReturns / stats.totalReturns) * 100) : 0,
      }))
      .sort((a, b) => b.percentLate - a.percentLate);
  };

  const getToolsReturnedLate = async (req, res) => {
    try {
      const { projectId, startDate, endDate, tools } = req.query;
      const normalizedProjectId = getSingleQueryValue(projectId);
      const start = parseDate(startDate);
      const end = parseDate(endDate);
      const toolList = parseTools(tools);

      if (projectId && !normalizedProjectId) {
        return res.status(400).json({
          success: false,
          error: 'Invalid projectId format.',
        });
      }

      if (normalizedProjectId && normalizedProjectId !== 'All') {
        if (!mongoose.Types.ObjectId.isValid(normalizedProjectId)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid projectId value.',
          });
        }
      }

      if (startDate && !start) {
        return res.status(400).json({
          success: false,
          error: 'Invalid startDate value.',
        });
      }

      if (endDate && !end) {
        return res.status(400).json({
          success: false,
          error: 'Invalid endDate value.',
        });
      }

      if (tools && !getSingleQueryValue(tools)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid tools value.',
        });
      }

      const matchFilter = {};
      if (normalizedProjectId && normalizedProjectId !== 'All') {
        matchFilter.projectId = new mongoose.Types.ObjectId(normalizedProjectId);
      }
      if (start || end) {
        matchFilter.date = {};
        if (start) matchFilter.date.$gte = start;
        if (end) matchFilter.date.$lte = end;
      }
      if (toolList.length > 0) {
        matchFilter.toolName = { $in: toolList };
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

      const projectIds = [
        ...new Set(toolData.map((record) => record.projectId?.toString()).filter(Boolean)),
      ];
      const projectNameById = await getProjectNameMap(projectIds);
      const results = buildToolStats(toolData, projectNameById);
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
      const projectIds = await ToolReturn.distinct('projectId');
      const projects = await Project.find({ _id: { $in: projectIds } }, '_id projectName')
        .sort({ projectName: 1 })
        .lean();
      const knownProjectIds = new Set(projects.map((project) => project._id.toString()));
      const fallbackProjects = projectIds
        .filter((projectId) => !knownProjectIds.has(projectId.toString()))
        .map((projectId, index) => ({
          _id: projectId,
          projectName: `Project ${index + 1}`,
        }));
      const allProjects = [...projects, ...fallbackProjects];
      res.status(200).json({
        success: true,
        data: allProjects.map((project) => ({
          projectId: project._id.toString(),
          projectName: project.projectName,
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
