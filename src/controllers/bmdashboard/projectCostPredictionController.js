const ProjectCostPrediction = require('../../models/bmdashboard/projectCostPrediction');

const controller = function (ProjectCostPrediction) {
  return {
    // Create a new project cost prediction
    createProjectCostPrediction: async (req, res) => {
      try {
        const { projectId, plannedCost, actualCost } = req.body;
        
        const newPrediction = new ProjectCostPrediction({
          projectId,
          plannedCost,
          actualCost
        });

        const savedPrediction = await newPrediction.save();
        res.status(201).json(savedPrediction);
      } catch (error) {
        res.status(400).json({ message: error.message });
      }
    },

    // Get all project cost predictions
    getAllProjectCostPredictions: async (req, res) => {
      try {
        const predictions = await ProjectCostPrediction.find();
        res.status(200).json(predictions);
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    },

    // Get project cost predictions by project ID
    getProjectCostPredictionsByProjectId: async (req, res) => {
      try {
        const { projectId } = req.params;
        const predictions = await ProjectCostPrediction.find({ projectId });
        res.status(200).json(predictions);
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    },

    // Update a project cost prediction
    updateProjectCostPrediction: async (req, res) => {
      try {
        const { id } = req.params;
        const { plannedCost, actualCost } = req.body;

        const updatedPrediction = await ProjectCostPrediction.findByIdAndUpdate(
          id,
          { 
            plannedCost,
            actualCost,
            updatedAt: Date.now()
          },
          { new: true }
        );

        if (!updatedPrediction) {
          return res.status(404).json({ message: 'Project cost prediction not found' });
        }

        res.status(200).json(updatedPrediction);
      } catch (error) {
        res.status(400).json({ message: error.message });
      }
    },

    // Delete a project cost prediction
    deleteProjectCostPrediction: async (req, res) => {
      try {
        const { id } = req.params;
        const deletedPrediction = await ProjectCostPrediction.findByIdAndDelete(id);

        if (!deletedPrediction) {
          return res.status(404).json({ message: 'Project cost prediction not found' });
        }

        res.status(200).json({ message: 'Project cost prediction deleted successfully' });
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    }
  };
};

module.exports = controller; 