const BuildingProject = require('../models/bmdashboard/buildingProject');
// Registers the invTypeBase model that BuildingTool.itemType populates from.
require('../models/bmdashboard/buildingInventoryType');

// Same rules as the Tools List (/bmdashboard/tools): the tool type's `using` and `available`
// arrays hold the tool ids, and a Lost or Needs Replacing tool is never shown as available.
const NEEDS_REPLACEMENT_CONDITIONS = ['Lost', 'Needs Replacing'];

const includesId = (ids, id) => Array.isArray(ids) && ids.some((x) => String(x) === String(id));

// Expects a tool with itemType populated (name, using, available). Each tool gets exactly one
// status, so the chart total equals the number of rows in the Tools List.
const getToolStatus = (tool) => {
  if (NEEDS_REPLACEMENT_CONDITIONS.includes(tool.condition)) return 'needsReplacement';
  if (includesId(tool.itemType?.using, tool._id)) return 'inUse';
  if (includesId(tool.itemType?.available, tool._id)) return 'available';
  // In neither list yet, e.g. a tool created by a purchase request.
  return 'yetToReceive';
};

// The Tools List filters projects by name, so a project that shares its name with another
// record (e.g. two "Building 1" projects) shows the tools of both. Charts use the same scope.
const getProjectIdsSharingName = async (projectId) => {
  const project = await BuildingProject.findById(projectId).select('name').lean();
  if (!project) return [projectId];
  const sameName = await BuildingProject.find({ name: project.name }).select('_id').lean();
  return sameName.map((p) => p._id);
};

module.exports = { getToolStatus, getProjectIdsSharingName };
