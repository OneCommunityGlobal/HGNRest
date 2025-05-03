const controller = function (ProjectCost) {
  return {
    // Create a new project cost entry
    createProject: async (req, res) => {
      try {
        const { projectId, costs } = req.body;
        
        const newProjectCost = new ProjectCost({
          projectId,
          costs
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
        const projectCost = await ProjectCost.findOne({ projectId: Number(projectId) });
        
        if (!projectCost) {
          return res.status(404).json({ message: 'Project not found' });
        }
        
        res.status(200).json(projectCost);
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    },

    // Add a new cost entry to a project
    addCostEntry: async (req, res) => {
      try {
        const { projectId } = req.params;
        const { month, plannedCost, actualCost, predictedCost } = req.body;

        const projectCost = await ProjectCost.findOne({ projectId: Number(projectId) });
        if (!projectCost) {
          return res.status(404).json({ message: 'Project not found' });
        }

        projectCost.costs.push({
          month,
          plannedCost,
          actualCost,
          predictedCost
        });

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
        const { month, plannedCost, actualCost, predictedCost } = req.body;

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
        costEntry.predictedCost = predictedCost;

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
    }
  };
};

module.exports = controller; 