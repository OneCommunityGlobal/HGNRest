const regression = require('regression');
const mongoose = require('mongoose');
const controller = function (ProjectCost) {
  // Helper function to calculate predicted costs using linear regression
  const calculatePredictedCosts = (costs) => {
    if (!costs || costs.length < 2) {
      return costs;
    }

    // Find the last month with actual cost data
    const lastActualCostIndex = costs.findIndex(cost => cost.actualCost === null || cost.actualCost === undefined);
    const historicalCosts = lastActualCostIndex === -1 ? costs : costs.slice(0, lastActualCostIndex);
    
    // Only perform regression if we have enough historical data
    if (historicalCosts.length < 2) {
      return costs;
    }

    // Prepare data for regression using only historical actual costs
    const data = historicalCosts.map((cost, index) => [index, cost.actualCost || 0]);
    
    // Perform linear regression
    const result = regression.linear(data);
    
    // Generate predictions for future months
    return costs.map((cost, index) => {
      if (index < historicalCosts.length) {
        // For historical months, set predictedCost to null
        return {
          ...cost,
          predictedCost: null
        };
      } else {
        // For future months, use planned costs as the base and adjust based on historical trend
        const plannedCost = cost.plannedCost || 0;
        
        // Calculate the average deviation from planned costs in historical data
        const historicalDeviations = historicalCosts.map(c => 
          c.actualCost ? (c.actualCost - c.plannedCost) / c.plannedCost : 0
        );
        const avgDeviation = historicalDeviations.reduce((a, b) => a + b, 0) / historicalDeviations.length;
        
        // Adjust planned cost based on historical deviation
        const adjustedPrediction = Math.round(plannedCost * (1 + avgDeviation));
        
        return {
          ...cost,
          predictedCost: adjustedPrediction
        };
      }
    });
  };

  // Get project costs (planned and actual)
  const getProjectCosts = async (req, res) => {
    try {
      const { projectId } = req.params;
      console.log('Fetching costs for project ID:', projectId);
      
      const projectCost = await ProjectCost.findOne({
        $or: [
          { projectId: projectId },
          { projectId: Number(projectId) }
        ]
      });
      
      if (!projectCost) {
        console.log('Project not found with ID:', projectId);
        return res.status(404).json({ message: 'Project not found' });
      }
      
      // Format the response to include only relevant cost data
      const costData = projectCost.costs.map(cost => ({
        month: cost.month,
        plannedCost: cost.plannedCost || 0,
        actualCost: cost.actualCost  // Remove the || 0 to preserve null values
      }));
      
      res.status(200).json({
        projectId: Number(projectId),
        costs: costData
      });
    } catch (error) {
      console.error('Error in getProjectCosts:', error);
      res.status(500).json({ message: 'Error fetching project costs. Please try again.' });
    }
  };

  // Get project cost predictions
  const getProjectPredictions = async (req, res) => {
    try {
      const { projectId } = req.params;
      const projectCost = await ProjectCost.findOne({ projectId: Number(projectId) });
      
      if (!projectCost) {
        return res.status(404).json({ message: 'Project not found' });
      }
      
      // Calculate predictions for the project's costs
      const costsWithPredictions = calculatePredictedCosts(projectCost.costs);
      
      // Filter to only include months that have a predictedCost value and map to clean objects
      const predictions = costsWithPredictions
        .filter(cost => cost.predictedCost !== null && cost.predictedCost !== undefined)
        .map(cost => ({
          month: cost._doc.month,
          plannedCost: cost._doc.plannedCost,
          actualCost: cost._doc.actualCost,
          predictedCost: cost.predictedCost
        }));
      
      res.status(200).json({
        projectId: Number(projectId),
        predictions: predictions
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };

  return {
    // Create a new project cost entry
    createProject: async (req, res) => {
      try {
        const { projectId, costs } = req.body;
        
        // Calculate predicted costs using linear regression
        const costsWithPredictions = calculatePredictedCosts(costs);
        
        const newProjectCost = new ProjectCost({
          projectId,
          costs: costsWithPredictions
        });

        const savedProjectCost = await newProjectCost.save();
        res.status(201).json(savedProjectCost);
      } catch (error) {
        res.status(400).json({ message: error.message });
      }
    },

    // Get all project costs
    getAllProjects: async (req,res) => {
      try {
        const projectCosts = await ProjectCost.find();
        res.status(200).json(projectCosts);
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    },

    // Get project costs by project ID
    getProjectByProjectId: async (req, res) => {
      try {
        const { projectId } = req.params;
        console.log('Received request for project ID:', projectId);
        
        // Check if the projectId is a MongoDB ObjectId
        const isObjectId = mongoose.Types.ObjectId.isValid(projectId);
        
        let query;
        if (isObjectId) {
          query = { _id: projectId };
        } else {
          // Try to convert to number for numeric projectId
          const numericProjectId = parseInt(projectId, 10);
          if (isNaN(numericProjectId)) {
            console.log('Invalid project ID format');
            return res.status(400).json({ 
              message: 'Invalid project ID format',
              providedId: projectId
            });
          }
          query = { projectId: numericProjectId };
        }
        
        console.log('Searching database with query:', query);
        const project = await ProjectCost.findOne(query);
        
        if (!project) {
          console.log('Project not found in database');
          return res.status(404).json({ 
            message: 'Project not found',
            searchedId: projectId
          });
        }
        
        console.log('Found project:', {
          id: project._id,
          projectId: project.projectId,
          costsCount: project.costs.length
        });
        
        res.status(200).json(project);
      } catch (error) {
        console.error('Error in getProjectByProjectId:', error);
        console.log(error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
          message: 'Error fetching project. Please try again.',
          error: error.message
        });
      }
    },

    // Get project costs by project ID
    getProjectCost: async (req, res) => {
      try {
        const { projectId } = req.params;
        console.log('Searching for project with ID:', projectId);
        console.log('Type of projectId:', typeof projectId);
        
        // Try both string and number versions of the ID
        const query = {
          $or: [
            { projectId: projectId },
            { projectId: Number(projectId) }
          ]
        };
        console.log('MongoDB query:', JSON.stringify(query));
        
        const projectCost = await ProjectCost.findOne(query);
        
        if (!projectCost) {
          console.log('Project not found with ID:', projectId);
          return res.status(404).json({ message: 'Project not found' });
        }
        
        console.log('Found project:', JSON.stringify(projectCost));
        res.status(200).json(projectCost);
      } catch (error) {
        console.error('Error in getProjectCost:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
          message: 'Error fetching project. Please try again.',
          error: error.message 
        });
      }
    },

    // Add a new cost entry to a project
    addCostEntry: async (req, res) => {
      try {
        const { projectId } = req.params;
        const { month, plannedCost, actualCost } = req.body;

        const projectCost = await ProjectCost.findOne({ projectId: Number(projectId) });
        if (!projectCost) {
          return res.status(404).json({ message: 'Project not found' });
        }

        // Add new cost entry
        projectCost.costs.push({
          month,
          plannedCost,
          actualCost
        });

        // Recalculate all predictions
        projectCost.costs = calculatePredictedCosts(projectCost.costs);

        const updatedProjectCost = await projectCost.save();
        res.status(200).json(updatedProjectCost);
      } catch (error) {
        res.status(400).json({ message: error.message });
      }
    },

    // Update a specific cost entry
    updateCostEntry: async (req, res) => {
      try {
        const { projectId, costId } = req.params;
        const { month, plannedCost, actualCost } = req.body;

        const projectCost = await ProjectCost.findOne({ projectId: Number(projectId) });
        if (!projectCost) {
          return res.status(404).json({ message: 'Project not found' });
        }

        const costEntry = projectCost.costs.id(costId);
        if (!costEntry) {
          return res.status(404).json({ message: 'Cost entry not found' });
        }

        costEntry.month = month;
        costEntry.plannedCost = plannedCost;
        costEntry.actualCost = actualCost;

        // Recalculate all predictions
        projectCost.costs = calculatePredictedCosts(projectCost.costs);

        const updatedProjectCost = await projectCost.save();
        res.status(200).json(updatedProjectCost);
      } catch (error) {
        res.status(400).json({ message: error.message });
      }
    },

    // Delete a project cost entry
    deleteProject: async (req, res) => {
      try {
        const { projectId } = req.params;
        const deletedProjectCost = await ProjectCost.findOneAndDelete({ projectId: Number(projectId) });

        if (!deletedProjectCost) {
          return res.status(404).json({ message: 'Project not found' });
        }

        res.status(200).json({ message: 'Project deleted successfully' });
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    },

    // Get project cost predictions
    getProjectPredictions,

    // Get project costs
    getProjectCosts
  };
};

module.exports = controller; 