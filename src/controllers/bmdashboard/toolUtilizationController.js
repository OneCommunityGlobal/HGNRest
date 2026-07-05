const mongoose = require('mongoose');

const toolUtilizationController = (BuildingTool) => {
  // Shared helper: compute utilization data for a given set of tools and date range
  const computeUtilizationForRange = (tools, rangeStart, rangeEnd) => {
    const totalHours = (rangeEnd - rangeStart) / (1000 * 60 * 60);

    // Group tools by itemType
    const toolGroups = {};
    tools.forEach((toolItem) => {
      if (!toolItem.itemType) return;
      const toolName = toolItem.itemType.name || 'Unknown Tool';
      const toolTypeId = toolItem.itemType._id.toString();
      if (!toolGroups[toolTypeId]) {
        toolGroups[toolTypeId] = { name: toolName, tools: [] };
      }
      toolGroups[toolTypeId].tools.push(toolItem);
    });

    // Calculate utilization per tool group
    const utilizationData = Object.values(toolGroups).map((group) => {
      let totalCheckedOutHours = 0;
      let totalDowntimeHours = 0;
      let toolCount = 0;

      group.tools.forEach((toolItem) => {
        toolCount += 1;

        const relevantLogs = (toolItem.logRecord || []).filter((log) => {
          const logDate = new Date(log.date);
          return logDate >= rangeStart && logDate <= rangeEnd;
        });

        relevantLogs.sort((a, b) => new Date(a.date) - new Date(b.date));

        let checkedOutTime = 0;
        let lastCheckOut = null;

        relevantLogs.forEach((log) => {
          if (log.type === 'Check Out') {
            lastCheckOut = new Date(log.date);
          } else if (log.type === 'Check In' && lastCheckOut) {
            const checkInTime = new Date(log.date);
            const hoursCheckedOut = (checkInTime - lastCheckOut) / (1000 * 60 * 60);
            checkedOutTime += Math.max(0, hoursCheckedOut);
            lastCheckOut = null;
          }
        });

        if (lastCheckOut) {
          const hoursCheckedOut = (rangeEnd - lastCheckOut) / (1000 * 60 * 60);
          checkedOutTime += Math.max(0, hoursCheckedOut);
        }

        if (relevantLogs.length === 0 && toolItem.logRecord && toolItem.logRecord.length > 0) {
          const sortedAllLogs = [...toolItem.logRecord].sort(
            (a, b) => new Date(b.date) - new Date(a.date),
          );
          const lastLog = sortedAllLogs[0];
          if (lastLog && lastLog.type === 'Check Out') {
            const lastCheckOutDate = new Date(lastLog.date);
            if (lastCheckOutDate < rangeStart) {
              checkedOutTime = totalHours;
            }
          }
        }

        totalCheckedOutHours += checkedOutTime;
      });

      totalDowntimeHours = totalHours * toolCount - totalCheckedOutHours;

      const totalPossibleHours = totalHours * toolCount;
      const utilizationRate =
        totalPossibleHours > 0 ? Math.round((totalCheckedOutHours / totalPossibleHours) * 100) : 0;

      return {
        name: group.name,
        utilizationRate,
        downtime: Math.round(totalDowntimeHours * 10) / 10,
        count: toolCount,
      };
    });

    utilizationData.sort((a, b) => b.utilizationRate - a.utilizationRate);
    return utilizationData;
  };

  // Split a date range into N weekly buckets
  const buildWeeklyBuckets = (rangeStart, rangeEnd, numWeeks = 4) => {
    const buckets = [];
    for (let i = 0; i < numWeeks; i += 1) {
      const bucketStart = new Date(rangeEnd);
      bucketStart.setDate(rangeEnd.getDate() - (numWeeks - i) * 7);
      const bucketEnd = new Date(rangeEnd);
      bucketEnd.setDate(rangeEnd.getDate() - (numWeeks - i - 1) * 7);
      const label = `Week of ${bucketStart.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })}`;
      buckets.push({ label, start: bucketStart, end: bucketEnd });
    }
    return buckets;
  };

  const getUtilization = async (req, res) => {
    try {
      const { tool, project, startDate, endDate, groupBy } = req.query;

      // Build filter for tools
      const toolFilter = {};

      if (tool && tool !== 'ALL') {
        if (mongoose.Types.ObjectId.isValid(tool)) {
          toolFilter.itemType = mongoose.Types.ObjectId(tool);
        }
      }

      if (project && project !== 'ALL') {
        if (mongoose.Types.ObjectId.isValid(project)) {
          toolFilter.project = mongoose.Types.ObjectId(project);
        }
      }

      // Fetch all matching tools once
      const tools = await BuildingTool.find({
        ...toolFilter,
        __t: 'tool_item',
      })
        .populate('itemType', 'name')
        .populate('project', 'name')
        .lean();

      // Resolve date range
      const defaultEnd = new Date();
      const defaultStart = new Date();
      defaultStart.setDate(defaultStart.getDate() - 30);

      const rangeStart = startDate ? new Date(startDate) : defaultStart;
      const rangeEnd = endDate ? new Date(endDate) : defaultEnd;

      // --- groupBy=week: return weekly bucketed avg utilization ---
      if (groupBy === 'week') {
        const buckets = buildWeeklyBuckets(rangeStart, rangeEnd, 4);

        const weeklyData = buckets.map(({ label, start, end }) => {
          const utilizationData = computeUtilizationForRange(tools, start, end);
          const avgUtilization =
            utilizationData.length > 0
              ? Math.round(
                  (utilizationData.reduce((sum, t) => sum + t.utilizationRate, 0) /
                    utilizationData.length) *
                    10,
                ) / 10
              : 0;
          return { week: label, avgUtilization };
        });

        return res.status(200).json(weeklyData);
      }

      // --- Default: return per-tool utilization ---
      const utilizationData = computeUtilizationForRange(tools, rangeStart, rangeEnd);
      return res.status(200).json(utilizationData);
    } catch (err) {
      console.error('Error calculating tool utilization:', err);
      res.status(500).json({ error: `Server error: ${err.message}` });
    }
  };

  return { getUtilization };
};

module.exports = toolUtilizationController;
