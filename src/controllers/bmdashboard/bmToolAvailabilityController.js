const mongoose = require('mongoose');
const { logException } = require('../../startup/logger');
// The Tools List model (tool_item in buildingInventoryItems), not the separate buildingTools
// collection, so the donut counts the same tools as the Tools List.
const { buildingTool: BuildingTool } = require('../../models/bmdashboard/buildingInventoryItem');
const { getToolStatus, getProjectIdsSharingName } = require('../../helpers/toolAvailabilityHelper');

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
  }

  try {
    if (projectId) {
      // Same project scope as the Tools List, which filters by project name.
      filter.project = { $in: await getProjectIdsSharingName(projectId) };
    }

    const tools = await BuildingTool.find(filter)
      .populate({ path: 'itemType', model: 'invTypeBase', select: 'name using available' })
      .populate('project', 'name')
      .lean();

    // Same status rules as the Tools List and the Tools by Availability chart. Editing a
    // tool's status from the Tools List does not add a log record, so log-based statuses
    // could disagree with the list.
    const counts = { available: 0, inUse: 0, needsReplacement: 0, yetToReceive: 0 };
    tools.forEach((tool) => {
      counts[getToolStatus(tool)] += 1;
    });

    const total = tools.length;
    const data = [
      { status: 'Available', count: counts.available },
      { status: 'Used', count: counts.inUse },
      { status: 'Needs Replacement', count: counts.needsReplacement },
      { status: 'Yet to Receive', count: counts.yetToReceive },
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
    logException(err, 'bmToolAvailabilityController.getToolAvailability', req.query);
    res.status(500).json({ error: 'Internal server error' });
  }
};
