const regression = require('regression');
const controller = function (ProjectCost) {
  // Helper function to calculate predicted costs using linear regression
  const calculatePredictedCosts = (costs) => {
    if (!costs || costs.length < 2) {
      return costs;
    }

    // Prepare data for regression
    const data = costs.map((cost, index) => [index, cost.actualCost || 0]);
    
    // Perform linear regression
    const result = regression.linear(data);
    
    // Generate predictions for each month
    return costs.map((cost, index) => ({
      ...cost,
      predictedCost: Math.max(0, Math.round(result.predict(index)[1])) // Ensure non-negative predictions
    }));
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
        actualCost: cost.actualCost || 0
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
      
      res.status(200).json({
        projectId: Number(projectId),
        costs: costsWithPredictions
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
        const projectCost = await ProjectCost.find({ projectId });
        res.status(200).json(projectCost);
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    },

    // Get project costs by project ID
    getProjectCost: async (req, res) => {
      try {
        const { projectId } = req.params;
        console.log('Searching for project with ID:', projectId);
        
        // Try both string and number versions of the ID
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
        
        console.log('Found project:', projectCost);
        res.status(200).json(projectCost);
      } catch (error) {
        console.error('Error in getProjectCost:', error);
        res.status(500).json({ message: 'Error fetching project. Please try again.' });
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