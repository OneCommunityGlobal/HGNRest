const mongoose = require('mongoose');
const BuildingTool = require('../../models/bmdashboard/buildingTool');
const { TOOL_CONDITIONS, TOOL_LOG_TYPES } = require('../../utilities/constants');

// Helper function to validate exact ObjectId format
const isValidMongoId = (id) =>
  mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === id;

exports.getToolAvailability = async (req, res) => {
  const { toolId, projectId } = req.query;
  const filter = {};

  if (toolId) {
    if (!isValidMongoId(toolId)) {
      return res.status(400).json({ error: 'Invalid toolId format' });
    }
    filter.itemType = toolId;
  }

  if (projectId) {
    if (!isValidMongoId(projectId)) {
      return res.status(400).json({ error: 'Invalid projectId format' });
    }
    filter.project = projectId;
  }

  try {
    const tools = await BuildingTool.find(filter)
      .populate({ path: 'itemType', model: 'invTypeBase', select: 'name' })
      .populate('project', 'name')
      .lean();

    const { available, used, maintenance } = tools.reduce(
      (acc, tool) => {
        const lastLog = tool.logRecord?.[tool.logRecord.length - 1];
        const lastUpdate = tool.updateRecord?.[tool.updateRecord.length - 1];

        if (lastUpdate?.condition === TOOL_CONDITIONS.OUT_OF_ORDER) {
          acc.maintenance += 1;
        } else if (lastLog?.type === TOOL_LOG_TYPES.CHECK_OUT) {
          acc.used += 1;
        } else {
          acc.available += 1;
        }

        return acc;
      },
      { available: 0, used: 0, maintenance: 0 },
    );

    const total = available + used + maintenance;
    const data = [
      { status: 'Available', count: available },
      { status: 'Used', count: used },
      { status: 'Maintenance', count: maintenance },
    ].map((entry) => ({
      ...entry,
      percentage: total > 0 ? parseFloat(((entry.count / total) * 100).toFixed(1)) : 0,
    }));

    const toolDropdownData = tools.map((tool) => ({
      _id: tool._id,
      toolId: tool.itemType?._id,
      name: tool.itemType?.name || 'Unnamed Tool',
      projectId: tool.project?._id,
      projectName: tool.project?.name || '',
    }));

    return res.status(200).json({ data, total, tools: toolDropdownData });
  } catch (err) {
    console.error('Error calculating tool availability:', err.message, err.stack);
    res.status(500).json({ error: 'Internal server error' });
  }
};
