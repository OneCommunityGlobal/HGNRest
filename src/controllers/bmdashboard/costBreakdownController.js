/* eslint-disable import/no-unresolved, import/no-extraneous-dependencies, import/no-cycle, import/order, import/no-self-import */
const moment = require('moment');

const controller = function (CostBreakdown) {
  // Get cost breakdown for a specific project with optional date filtering
  const getCostBreakdown = async (req, res) => {
    try {
      const { projectId } = req.params;
      const { fromDate, toDate } = req.query;

      console.log('Fetching cost breakdown for project ID:', projectId);
      console.log('Date range:', { fromDate, toDate });

      // Find the cost breakdown for the project
      const costBreakdown = await CostBreakdown.findOne({
        $or: [{ projectId }, { projectId: Number(projectId) }],
      });

      if (!costBreakdown) {
        console.log('Cost breakdown not found for project ID:', projectId);
        return res.status(404).json({
          message: 'Cost breakdown not found for this project',
          projectId: Number(projectId),
        });
      }

      let filteredCosts = costBreakdown.costs;

      // Apply date filtering if provided
      if (fromDate || toDate) {
        filteredCosts = costBreakdown.costs.filter((cost) => {
          const costDate = moment(cost.month, 'MMM YYYY');

          if (fromDate && toDate) {
            const from = moment(fromDate);
            const to = moment(toDate);
            return costDate.isBetween(from, to, 'month', '[]');
          }
          if (fromDate) {
            const from = moment(fromDate);
            return costDate.isSameOrAfter(from, 'month');
          }
          if (toDate) {
            const to = moment(toDate);
            return costDate.isSameOrBefore(to, 'month');
          }

          return true;
        });
      }

      // Format the response
      const responseData = {
        projectId: Number(projectId),
        actual: filteredCosts.map((cost) => ({
          month: cost.month,
          plumbing: cost.plumbing || 0,
          electrical: cost.electrical || 0,
          structural: cost.structural || 0,
          mechanical: cost.mechanical || 0,
        })),
      };

      res.status(200).json(responseData);
    } catch (error) {
      console.error('Error in getCostBreakdown:', error);
      res.status(500).json({
        message: 'Error fetching cost breakdown. Please try again.',
        error: error.message,
      });
    }
  };

  // Create a new cost breakdown entry for a project
  const createCostBreakdown = async (req, res) => {
    try {
      const { projectId, costs } = req.body;

      // Validate required fields
      if (!projectId || !costs || !Array.isArray(costs)) {
        return res.status(400).json({
          message: 'Project ID and costs array are required',
        });
      }

      // Check if cost breakdown already exists for this project
      const existingBreakdown = await CostBreakdown.findOne({
        projectId: Number(projectId),
      });

      if (existingBreakdown) {
        return res.status(409).json({
          message: 'Cost breakdown already exists for this project',
        });
      }

      // Create new cost breakdown
      const newCostBreakdown = new CostBreakdown({
        projectId: Number(projectId),
        costs,
      });

      const savedCostBreakdown = await newCostBreakdown.save();
      res.status(201).json(savedCostBreakdown);
    } catch (error) {
      console.error('Error in createCostBreakdown:', error);
      res.status(400).json({
        message: error.message,
      });
    }
  };

  // Add a new cost entry to an existing project
  const addCostEntry = async (req, res) => {
    try {
      const { projectId } = req.params;
      const { month, plumbing, electrical, structural, mechanical } = req.body;

      const costBreakdown = await CostBreakdown.findOne({
        projectId: Number(projectId),
      });

      if (!costBreakdown) {
        return res.status(404).json({
          message: 'Cost breakdown not found for this project',
        });
      }

      // Add new cost entry
      costBreakdown.costs.push({
        month,
        plumbing: plumbing || 0,
        electrical: electrical || 0,
        structural: structural || 0,
        mechanical: mechanical || 0,
      });

      const updatedCostBreakdown = await costBreakdown.save();
      res.status(200).json(updatedCostBreakdown);
    } catch (error) {
      console.error('Error in addCostEntry:', error);
      res.status(400).json({
        message: error.message,
      });
    }
  };

  // Update a specific cost entry
  const updateCostEntry = async (req, res) => {
    try {
      const { projectId, costId } = req.params;
      const { month, plumbing, electrical, structural, mechanical } = req.body;

      const costBreakdown = await CostBreakdown.findOne({
        projectId: Number(projectId),
      });

      if (!costBreakdown) {
        return res.status(404).json({
          message: 'Cost breakdown not found for this project',
        });
      }

      const costEntry = costBreakdown.costs.id(costId);
      if (!costEntry) {
        return res.status(404).json({
          message: 'Cost entry not found',
        });
      }

      // Update fields
      if (month !== undefined) costEntry.month = month;
      if (plumbing !== undefined) costEntry.plumbing = plumbing;
      if (electrical !== undefined) costEntry.electrical = electrical;
      if (structural !== undefined) costEntry.structural = structural;
      if (mechanical !== undefined) costEntry.mechanical = mechanical;

      const updatedCostBreakdown = await costBreakdown.save();
      res.status(200).json(updatedCostBreakdown);
    } catch (error) {
      console.error('Error in updateCostEntry:', error);
      res.status(400).json({
        message: error.message,
      });
    }
  };

  // Get all cost breakdowns (for admin purposes)
  const getAllCostBreakdowns = async (req, res) => {
    try {
      const costBreakdowns = await CostBreakdown.find();
      res.status(200).json(costBreakdowns);
    } catch (error) {
      console.error('Error in getAllCostBreakdowns:', error);
      res.status(500).json({
        message: error.message,
      });
    }
  };

  // Delete a cost breakdown for a project
  const deleteCostBreakdown = async (req, res) => {
    try {
      const { projectId } = req.params;
      const deletedCostBreakdown = await CostBreakdown.findOneAndDelete({
        projectId: Number(projectId),
      });

      if (!deletedCostBreakdown) {
        return res.status(404).json({
          message: 'Cost breakdown not found for this project',
        });
      }

      res.status(200).json({
        message: 'Cost breakdown deleted successfully',
      });
    } catch (error) {
      console.error('Error in deleteCostBreakdown:', error);
      res.status(500).json({
        message: error.message,
      });
    }
  };

  return {
    getCostBreakdown,
    createCostBreakdown,
    addCostEntry,
    updateCostEntry,
    getAllCostBreakdowns,
    deleteCostBreakdown,
  };
};

module.exports = controller;
