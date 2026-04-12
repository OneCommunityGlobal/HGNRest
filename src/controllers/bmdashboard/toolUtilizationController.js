const mongoose = require('mongoose');

const toolUtilizationController = (BuildingTool) => {
  const getUtilization = async (req, res) => {
    try {
      const { tool, project, startDate, endDate } = req.query;

      // Build filter for tools
      const toolFilter = {};

      // Filter by tool type if specified
      if (tool && tool !== 'ALL') {
        if (mongoose.Types.ObjectId.isValid(tool)) {
          toolFilter.itemType = mongoose.Types.ObjectId(tool);
        }
      }

      // Filter by project if specified
      if (project && project !== 'ALL') {
        if (mongoose.Types.ObjectId.isValid(project)) {
          toolFilter.project = mongoose.Types.ObjectId(project);
        }
      }

      // Fetch tools with their log records
      // For discriminator models, we need to filter by __t field
      const tools = await BuildingTool.find({
        ...toolFilter,
        __t: 'tool_item', // Filter for tool items only (discriminator field)
      })
        .populate('itemType', 'name')
        .populate('project', 'name')
        .lean();

      // Calculate date range
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;

      // If no date range specified, use last 30 days as default
      const defaultEnd = new Date();
      const defaultStart = new Date();
      defaultStart.setDate(defaultStart.getDate() - 30);

      const rangeStart = start || defaultStart;
      const rangeEnd = end || defaultEnd;
      const totalHours = (rangeEnd - rangeStart) / (1000 * 60 * 60); // Convert to hours

      // Group tools by itemType (tool name)
      const toolGroups = {};

      tools.forEach((toolItem) => {
        if (!toolItem.itemType) return; // Skip if no itemType

        const toolName = toolItem.itemType.name || 'Unknown Tool';
        const toolTypeId = toolItem.itemType._id.toString();

        if (!toolGroups[toolTypeId]) {
          toolGroups[toolTypeId] = {
            name: toolName,
            tools: [],
          };
        }

        toolGroups[toolTypeId].tools.push(toolItem);
      });

      // Calculate utilization for each tool type
      const utilizationData = Object.values(toolGroups).map((group) => {
        let totalCheckedOutHours = 0;
        let totalDowntimeHours = 0;
        let toolCount = 0;

        group.tools.forEach((toolItem) => {
          toolCount += 1;

          // Filter log records by date range
          const relevantLogs = (toolItem.logRecord || []).filter((log) => {
            const logDate = new Date(log.date);
            return logDate >= rangeStart && logDate <= rangeEnd;
          });

          // Sort logs by date
          relevantLogs.sort((a, b) => new Date(a.date) - new Date(b.date));

          // Calculate checked out time
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

          // If still checked out at the end of the range
          if (lastCheckOut) {
            const hoursCheckedOut = (rangeEnd - lastCheckOut) / (1000 * 60 * 60);
            checkedOutTime += Math.max(0, hoursCheckedOut);
          }

          // If no logs in range, check if tool was checked out before range start
          if (relevantLogs.length === 0 && toolItem.logRecord && toolItem.logRecord.length > 0) {
            const sortedAllLogs = [...toolItem.logRecord].sort(
              (a, b) => new Date(b.date) - new Date(a.date),
            );
            const lastLog = sortedAllLogs[0];
            if (lastLog && lastLog.type === 'Check Out') {
              const lastCheckOutDate = new Date(lastLog.date);
              if (lastCheckOutDate < rangeStart) {
                // Tool was checked out before range start, count entire range as checked out
                checkedOutTime = totalHours;
              }
            }
          }

          totalCheckedOutHours += checkedOutTime;
        });

        // Calculate downtime (time not checked out)
        totalDowntimeHours = totalHours * toolCount - totalCheckedOutHours;

        // Calculate utilization rate
        const totalPossibleHours = totalHours * toolCount;
        const utilizationRate =
          totalPossibleHours > 0
            ? Math.round((totalCheckedOutHours / totalPossibleHours) * 100)
            : 0;

        return {
          name: group.name,
          utilizationRate,
          downtime: Math.round(totalDowntimeHours * 10) / 10, // Round to 1 decimal place
        };
      });

      // Sort by utilization rate (descending)
      utilizationData.sort((a, b) => b.utilizationRate - a.utilizationRate);

      res.status(200).json(utilizationData);
    } catch (err) {
      console.error('Error calculating tool utilization:', err);
      res.status(500).json({
        error: `Server error: ${err.message}`,
      });
    }
  };

  return {
    getUtilization,
  };
};

module.exports = toolUtilizationController;
