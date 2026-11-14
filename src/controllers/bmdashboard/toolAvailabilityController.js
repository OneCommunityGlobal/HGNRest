const mongoose = require('mongoose');
const BuildingProject = require('../../models/bmdashboard/buildingProject');
const { logException } = require('../../startup/logger');
const { getToolStatus, getProjectIdsSharingName } = require('../../helpers/toolAvailabilityHelper');

const { ObjectId } = mongoose.Types;

// Reads the same BuildingTool records as the Tools List (/bmdashboard/tools), so the
// "Tools by Availability" chart shows the same tools with the same statuses.
const toolAvailabilityController = function (BuildingTool) {
  const getToolsAvailability = async (req, res) => {
    try {
      const { id: projectId } = req.params;

      if (!ObjectId.isValid(projectId)) {
        return res.status(400).json({ error: 'Invalid project ID format' });
      }

      // startDate/endDate are accepted but not applied: like the Tools List, this shows each
      // tool's current status, and tool records hold no dated status history to filter on.
      const projectIds = await getProjectIdsSharingName(projectId);
      const tools = await BuildingTool.find({ project: { $in: projectIds } })
        .populate({ path: 'itemType', model: 'invTypeBase', select: 'name using available' })
        .lean();

      // Names that differ only by case or surrounding spaces are one tool.
      const byName = new Map();
      tools.forEach((tool) => {
        const name = (tool.itemType?.name || '').trim() || 'Unnamed Tool';
        const key = name.toLowerCase();
        if (!byName.has(key)) {
          byName.set(key, {
            spellings: new Map(),
            inUse: 0,
            needsReplacement: 0,
            yetToReceive: 0,
            available: 0,
          });
        }
        const entry = byName.get(key);
        entry.spellings.set(name, (entry.spellings.get(name) || 0) + 1);
        entry[getToolStatus(tool)] += 1;
      });

      const results = [...byName.values()].map(({ spellings, ...counts }) => {
        // Show the most used spelling; ties go to the one that sorts first ("Circular Saw").
        const [toolName] = [...spellings.entries()].sort(
          ([a, countA], [b, countB]) => countB - countA || (a < b ? -1 : 1),
        )[0];
        return { toolName, ...counts };
      });
      results.sort((a, b) => a.toolName.localeCompare(b.toolName));

      return res.json(results);
    } catch (error) {
      logException(error, 'toolAvailabilityController.getToolsAvailability', req.params);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };

  const getUniqueProjectIds = async (req, res) => {
    try {
      const projectIds = await BuildingTool.distinct('project');

      const validProjectIds = projectIds
        .filter((id) => ObjectId.isValid(id))
        .map((id) => new ObjectId(String(id)));

      if (validProjectIds.length === 0) {
        return res.json([]);
      }

      const projects = await BuildingProject.find({
        _id: { $in: validProjectIds },
      })
        .select('_id name')
        .sort({ name: 1 })
        .lean();

      // One entry per name, like the Tools List project filter. Selecting it covers every
      // project record with that name (see getProjectIdsSharingName).
      const seenNames = new Set();
      const formattedResults = projects
        .filter((project) => {
          if (seenNames.has(project.name)) return false;
          seenNames.add(project.name);
          return true;
        })
        .map((project) => ({
          projectId: project._id,
          projectName: project.name,
        }));

      return res.json(formattedResults);
    } catch (error) {
      logException(error, 'toolAvailabilityController.getUniqueProjectIds');
      return res.status(500).json({ error: 'Internal server error' });
    }
  };

  return {
    getToolsAvailability,
    getUniqueProjectIds,
  };
};

module.exports = toolAvailabilityController;
