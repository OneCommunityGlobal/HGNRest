const mongoose = require('mongoose');
const logger = require('../../startup/logger');

const bmFinancialController = function (BuildingProject, BuildingMaterial, BuildingTool) {
  // Helper functions defined first
  const calculateMaterialsCost = async (BuildingMaterialModel, projectId) => {
    try {
      const materials = await BuildingMaterialModel.find({ project: projectId });
      return materials.reduce((total, material) => total + (material.cost || 0), 0);
    } catch (error) {
      logger.logException(`Error calculating materials cost: ${error.message}`);
      return 0;
    }
  };

  const calculateToolsCost = async (BuildingToolModel, projectId) => {
    try {
      const tools = await BuildingToolModel.find({ project: projectId });
      return tools.reduce((total, tool) => total + (tool.cost || 0), 0);
    } catch (error) {
      logger.logException(`Error calculating tools cost: ${error.message}`);
      return 0;
    }
  };

  const calculateLaborCost = async (BuildingProjectModel, projectId) => {
    try {
      const project = await BuildingProjectModel.findById(projectId);
      return project?.laborCost || 0;
    } catch (error) {
      logger.logException(`Error calculating labor cost: ${error.message}`);
      return 0;
    }
  };

  const getTotalProjectCost = async (req, res) => {
    try {
      const project = await BuildingProject.findById(req.params.projectId);
      if (!project) {
        logger.logException(`Project with ID ${req.params.projectId} not found`);
        return res.status(404).json({ message: 'Project not found' });
      }
      const materialsCost = await calculateMaterialsCost(BuildingMaterial, project._id);
      const toolsCost = await calculateToolsCost(BuildingTool, project._id);
      const laborCost = await calculateLaborCost(BuildingProject, project._id);

      const totalCost = materialsCost + toolsCost + laborCost;
      res.status(200).json({
        totalCost,
      });
    } catch (error) {
      logger.logException(`Error fetching project cost: ${error.message}`);
      res.status(500).json({ message: 'Internal server error' });
    }
  };

  const getCostBreakdown = async (req, res) => {
    try {
      const project = await BuildingProject.findById(req.params.projectId);
      if (!project) {
        logger.logException(`Project with ID ${req.params.projectId} not found`);
        return res.status(404).json({ message: 'Project not found' });
      }
      const materialsCost = await calculateMaterialsCost(BuildingMaterial, project._id);
      const toolsCost = await calculateToolsCost(BuildingTool, project._id);
      const laborCost = await calculateLaborCost(BuildingProject, project._id);

      res.status(200).json({
        materialsCost,
        equipmentCost: toolsCost,
        laborCost,
      });
    } catch (error) {
      logger.logException(`Error fetching project cost breakdown: ${error.message}`);
      res.status(500).json({ message: 'Internal server error' });
    }
  };

  const getMonthOverMonthChanges = async (req, res) => {
    try {
      const { projectId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(projectId)) {
        return res.status(400).json({ message: 'Invalid project ID' });
      }

      const projectObjectId = new mongoose.Types.ObjectId(projectId);

      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(thisMonthStart);
      lastMonthStart.setMonth(thisMonthStart.getMonth() - 1);

      const monthEnd = (monthStart) => {
        const end = new Date(monthStart);
        end.setMonth(end.getMonth() + 1);
        return end;
      };

      const [materialDocs, toolDocs] = await Promise.all([
        BuildingMaterial.find({ project: projectObjectId }),
        BuildingTool.find({ project: projectObjectId }),
      ]);

      const calculateCost = (docs, monthStart) => {
        let cost = 0;
        const end = monthEnd(monthStart);

        docs.forEach((doc) => {
          if (!Array.isArray(doc.purchaseRecord)) return;

          doc.purchaseRecord.forEach((record) => {
            const rDate = new Date(record.date);
            if (
              record.status === 'Approved' &&
              !Number.isNaN(rDate.getTime()) &&
              rDate >= monthStart &&
              rDate < end
            ) {
              cost += (record.quantity || 0) * (record.unitPrice || 0);
            }
          });
        });

        return cost;
      };

      const thisMonthMaterialCost = calculateCost(materialDocs, thisMonthStart);
      const lastMonthMaterialCost = calculateCost(materialDocs, lastMonthStart);

      const thisMonthToolCost = calculateCost(toolDocs, thisMonthStart);
      const lastMonthToolCost = calculateCost(toolDocs, lastMonthStart);

      const thisMonthLaborCost = await calculateLaborCost(BuildingProject, projectObjectId);
      const lastMonthLaborCost = thisMonthLaborCost; // Replace with actual last month logic if available

      const calcMoMChange = (current, previous) => {
        if (previous === 0) return current === 0 ? 0 : 100;
        return ((current - previous) / previous) * 100;
      };

      res.status(200).json({
        materialCostChange: parseFloat(
          calcMoMChange(thisMonthMaterialCost, lastMonthMaterialCost).toFixed(2),
        ),
        laborCostChange: parseFloat(
          calcMoMChange(thisMonthLaborCost, lastMonthLaborCost).toFixed(2),
        ),
        equipmentCostChange: parseFloat(
          calcMoMChange(thisMonthToolCost, lastMonthToolCost).toFixed(2),
        ),
      });
    } catch (err) {
      res.status(500).json({ message: 'Internal server error' });
    }
  };

  const getProjectsFinancialsByType = async (req, res) => {
    try {
      const { projectType } = req.query;

      const projects = await BuildingProject.find({ projectType });

      const results = await Promise.all(
        projects.map(async (project) => {
          let materialsCost = 0;
          let toolsCost = 0;
          let laborCost = 0;

          try {
            materialsCost = await calculateMaterialsCost(BuildingMaterial, project._id);
          } catch (error) {
            logger.logException(
              `Materials cost error for project ${project._id}: ${error.message}`,
            );
          }

          try {
            toolsCost = await calculateToolsCost(BuildingTool, project._id);
          } catch (error) {
            logger.logException(`Tools cost error for project ${project._id}: ${error.message}`);
          }

          try {
            laborCost = await calculateLaborCost(BuildingProject, project._id);
          } catch (error) {
            logger.logException(`Labor cost error for project ${project._id}: ${error.message}`);
          }

          return {
            projectId: project._id,
            totalCost: materialsCost + toolsCost + laborCost,
            materialCost: materialsCost,
            laborCost,
            equipmentCost: toolsCost,
          };
        }),
      );

      res.status(200).json(results);
    } catch (err) {
      logger.logException(`Error fetching financial data by project type: ${err.message}`);
      res.status(500).json({ message: 'Internal server error' });
    }
  };

  const getProjectsFinancialsByDateRange = async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const start = new Date(startDate);
      const end = new Date(endDate);

      const projects = await BuildingProject.find({ dateCreated: { $gte: start, $lte: end } });

      const results = await Promise.all(
        projects.map(async (project) => {
          const materialsCost = await calculateMaterialsCost(BuildingMaterial, project._id);
          const toolsCost = await calculateToolsCost(BuildingTool, project._id);
          const laborCost = await calculateLaborCost(BuildingProject, project._id);
          const totalCost = materialsCost + toolsCost + laborCost;

          return {
            projectId: project._id,
            totalCost,
            materialCost: materialsCost,
            laborCost,
            equipmentCost: toolsCost,
          };
        }),
      );

      res.status(200).json(results);
    } catch (err) {
      logger.logException(`Error fetching financial data by date range: ${err.message}`);
      res.status(500).json({ message: 'Internal server error' });
    }
  };

  return {
    getTotalProjectCost,
    getCostBreakdown,
    getMonthOverMonthChanges,
    getProjectsFinancialsByType,
    getProjectsFinancialsByDateRange,
  };
};

module.exports = bmFinancialController;
