const mongoose = require('mongoose');
const ToolsDowntime = require('../../models/bmdashboard/toolsDowntime');

const bmToolsDowntimeController = () => {
  // Get all tools downtime records with optional query parameters
  const fetchAllToolsDowntime = async (req, res) => {
    try {
      const { toolId, projectId, startDate, endDate } = req.query;

      // Build filter object based on query parameters
      const filter = {};

      if (toolId) {
        filter.toolId = toolId;
      }

      if (projectId) {
        filter.projectId = projectId;
      }

      // Handle date range filtering using startDate and endDate fields
      if (startDate || endDate) {
        if (startDate && endDate) {
          // Filter records where the period overlaps with the query range
          filter.$or = [
            {
              startDate: { $lte: new Date(endDate) },
              endDate: { $gte: new Date(startDate) },
            },
          ];
        } else if (startDate) {
          // Records that end on or after the start date
          filter.endDate = { $gte: new Date(startDate) };
        } else if (endDate) {
          // Records that start on or before the end date
          filter.startDate = { $lte: new Date(endDate) };
        }
      }

      const toolsDowntime = await ToolsDowntime.find(filter).sort({ createdAt: -1 }).exec();

      res.status(200).json({
        success: true,
        data: toolsDowntime,
        count: toolsDowntime.length,
      });
    } catch (error) {
      const errorMessage = `Error occurred while fetching tools downtime records: ${error.message}`;
      console.error(errorMessage);
      res.status(500).json({
        success: false,
        message: errorMessage,
      });
    }
  };

  // Get single tools downtime record by ID
  const fetchSingleToolsDowntime = async (req, res) => {
    const { id } = req.params;

    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid tools downtime record ID',
        });
      }

      const toolsDowntime = await ToolsDowntime.findById(id);

      if (!toolsDowntime) {
        return res.status(404).json({
          success: false,
          message: 'Tools downtime record not found',
        });
      }

      res.status(200).json({
        success: true,
        data: toolsDowntime,
      });
    } catch (error) {
      const errorMessage = `Error occurred while fetching tools downtime record: ${error.message}`;
      console.error(errorMessage);
      res.status(500).json({
        success: false,
        message: errorMessage,
      });
    }
  };

  // Create new tools downtime record
  const createToolsDowntime = async (req, res) => {
    try {
      const { toolId, toolName, projectId, utilizationRate, downtimeHours, startDate, endDate } =
        req.body;

      // Validate required fields
      if (
        !toolId ||
        !toolName ||
        !projectId ||
        utilizationRate === undefined ||
        downtimeHours === undefined ||
        !startDate ||
        !endDate
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Missing required fields: toolId, toolName, projectId, utilizationRate, downtimeHours, startDate, endDate',
        });
      }

      // Validate utilization rate
      if (utilizationRate < 0 || utilizationRate > 100) {
        return res.status(400).json({
          success: false,
          message: 'Utilization rate must be between 0 and 100',
        });
      }

      // Validate downtime hours
      if (downtimeHours < 0) {
        return res.status(400).json({
          success: false,
          message: 'Downtime hours must be a positive number',
        });
      }

      // Validate dates
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);

      if (Number.isNaN(startDateObj.getTime()) || Number.isNaN(endDateObj.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format for startDate or endDate',
        });
      }

      if (startDateObj >= endDateObj) {
        return res.status(400).json({
          success: false,
          message: 'startDate must be before endDate',
        });
      }

      const newToolsDowntime = new ToolsDowntime({
        toolId,
        toolName,
        projectId,
        utilizationRate,
        downtimeHours,
        startDate: startDateObj,
        endDate: endDateObj,
      });

      const savedToolsDowntime = await newToolsDowntime.save();

      res.status(201).json({
        success: true,
        data: savedToolsDowntime,
        message: 'Tools downtime record created successfully',
      });
    } catch (error) {
      const errorMessage = `Error occurred while creating tools downtime record: ${error.message}`;
      console.error(errorMessage);
      res.status(500).json({
        success: false,
        message: errorMessage,
      });
    }
  };

  // Update tools downtime record
  const updateToolsDowntime = async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;

    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid tools downtime record ID',
        });
      }

      // Validate utilization rate if provided
      if (
        updateData.utilizationRate !== undefined &&
        (updateData.utilizationRate < 0 || updateData.utilizationRate > 100)
      ) {
        return res.status(400).json({
          success: false,
          message: 'Utilization rate must be between 0 and 100',
        });
      }

      // Validate downtime hours if provided
      if (updateData.downtimeHours !== undefined && updateData.downtimeHours < 0) {
        return res.status(400).json({
          success: false,
          message: 'Downtime hours must be a positive number',
        });
      }

      const updatedToolsDowntime = await ToolsDowntime.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
      });

      if (!updatedToolsDowntime) {
        return res.status(404).json({
          success: false,
          message: 'Tools downtime record not found',
        });
      }

      res.status(200).json({
        success: true,
        data: updatedToolsDowntime,
        message: 'Tools downtime record updated successfully',
      });
    } catch (error) {
      const errorMessage = `Error occurred while updating tools downtime record: ${error.message}`;
      console.error(errorMessage);
      res.status(500).json({
        success: false,
        message: errorMessage,
      });
    }
  };

  // Delete tools downtime record
  const deleteToolsDowntime = async (req, res) => {
    const { id } = req.params;

    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid tools downtime record ID',
        });
      }

      const deletedToolsDowntime = await ToolsDowntime.findByIdAndDelete(id);

      if (!deletedToolsDowntime) {
        return res.status(404).json({
          success: false,
          message: 'Tools downtime record not found',
        });
      }

      res.status(200).json({
        success: true,
        message: 'Tools downtime record deleted successfully',
      });
    } catch (error) {
      const errorMessage = `Error occurred while deleting tools downtime record: ${error.message}`;
      console.error(errorMessage);
      res.status(500).json({
        success: false,
        message: errorMessage,
      });
    }
  };

  // Get tools downtime records by project
  const getToolsDowntimeByProject = async (req, res) => {
    const { projectId } = req.params;

    try {
      const toolsDowntime = await ToolsDowntime.find({ projectId }).sort({ createdAt: -1 }).exec();

      res.status(200).json({
        success: true,
        data: toolsDowntime,
        count: toolsDowntime.length,
      });
    } catch (error) {
      const errorMessage = `Error occurred while fetching tools downtime records for project: ${error.message}`;
      console.error(errorMessage);
      res.status(500).json({
        success: false,
        message: errorMessage,
      });
    }
  };

  // Get tools downtime records by tool
  const getToolsDowntimeByTool = async (req, res) => {
    const { toolId } = req.params;

    try {
      const toolsDowntime = await ToolsDowntime.find({ toolId }).sort({ createdAt: -1 }).exec();

      res.status(200).json({
        success: true,
        data: toolsDowntime,
        count: toolsDowntime.length,
      });
    } catch (error) {
      const errorMessage = `Error occurred while fetching tools downtime records for tool: ${error.message}`;
      console.error(errorMessage);
      res.status(500).json({
        success: false,
        message: errorMessage,
      });
    }
  };

  // Get tools downtime statistics
  const getToolsDowntimeStats = async (req, res) => {
    try {
      const stats = await ToolsDowntime.aggregate([
        {
          $group: {
            _id: null,
            totalRecords: { $sum: 1 },
            avgUtilizationRate: { $avg: '$utilizationRate' },
            avgDowntimeHours: { $avg: '$downtimeHours' },
            totalDowntimeHours: { $sum: '$downtimeHours' },
            minUtilizationRate: { $min: '$utilizationRate' },
            maxUtilizationRate: { $max: '$utilizationRate' },
          },
        },
      ]);

      res.status(200).json({
        success: true,
        data: stats[0] || {
          totalRecords: 0,
          avgUtilizationRate: 0,
          avgDowntimeHours: 0,
          totalDowntimeHours: 0,
          minUtilizationRate: 0,
          maxUtilizationRate: 0,
        },
      });
    } catch (error) {
      const errorMessage = `Error occurred while fetching tools downtime statistics: ${error.message}`;
      console.error(errorMessage);
      res.status(500).json({
        success: false,
        message: errorMessage,
      });
    }
  };

  return {
    fetchAllToolsDowntime,
    fetchSingleToolsDowntime,
    createToolsDowntime,
    updateToolsDowntime,
    deleteToolsDowntime,
    getToolsDowntimeByProject,
    getToolsDowntimeByTool,
    getToolsDowntimeStats,
  };
};

module.exports = bmToolsDowntimeController;
