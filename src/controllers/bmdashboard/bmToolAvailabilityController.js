const BuildingTool = require('../../models/bmdashboard/buildingTool');

exports.getToolAvailability = async (req, res) => {
  const { toolId, projectId } = req.query;
  const filter = {};
  if (toolId) filter.itemType = toolId;
  if (projectId) filter.project = projectId;

  try {
    const tools = await BuildingTool.find(filter).lean();

    let available = 0;
    let used = 0;
    let maintenance = 0;

    for (const tool of tools) {
      const lastLog = tool.logRecord?.[tool.logRecord.length - 1];
      const lastUpdate = tool.updateRecord?.[tool.updateRecord.length - 1];

      if (lastUpdate?.condition === 'Out of Order') {
        maintenance++;
      } else if (lastLog?.type === 'Check Out') {
        used++;
      } else {
        available++;
      }
    }

    const total = available + used + maintenance;
    const data = [
      { status: 'Available', count: available },
      { status: 'Used', count: used },
      { status: 'Maintenance', count: maintenance },
    ].map(entry => ({
      ...entry,
      percentage: total > 0 ? parseFloat(((entry.count / total) * 100).toFixed(1)) : 0,
    }));

    return res.status(200).json({ data, total });
  } catch (err) {
    console.error('Error calculating tool availability:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
