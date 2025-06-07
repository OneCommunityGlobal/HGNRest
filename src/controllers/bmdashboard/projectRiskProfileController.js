const mongoose = require('mongoose');
const ProjectRiskProfile = require('../../models/bmdashboard/projectRiskProfile');

const projectRiskProfileController = {
  // Get all risk profiles
  getAllRiskProfiles: async (req, res) => {
    try {
      const riskProfiles = await ProjectRiskProfile.find()
        .populate('issues')
        .lean();
      res.status(200).json(riskProfiles);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Get risk profile by project ID
  getRiskProfileByProjectId: async (req, res) => {
    try {
      const riskProfile = await ProjectRiskProfile.findOne({ projectId: req.params.projectId })
        .populate('issues')
        .lean();
      
      if (!riskProfile) {
        return res.status(404).json({ message: 'Risk profile not found' });
      }
      
      res.status(200).json(riskProfile);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Create new risk profile
  createRiskProfile: async (req, res) => {
    try {
      const riskProfile = new ProjectRiskProfile({
        projectId: req.body.projectId,
        startDate: req.body.startDate,
        endDate: req.body.endDate,
        initialCostEstimate: req.body.initialCostEstimate,
        currentCostIncurred: req.body.currentCostIncurred,
        issues: req.body.issues
      });

      const savedRiskProfile = await riskProfile.save();
      res.status(201).json(savedRiskProfile);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  // Update risk profile
  updateRiskProfile: async (req, res) => {
    try {
      const updatedRiskProfile = await ProjectRiskProfile.findOneAndUpdate(
        { projectId: req.params.projectId },
        {
          $set: {
            startDate: req.body.startDate,
            endDate: req.body.endDate,
            initialCostEstimate: req.body.initialCostEstimate,
            currentCostIncurred: req.body.currentCostIncurred,
            issues: req.body.issues
          }
        },
        { new: true }
      );

      if (!updatedRiskProfile) {
        return res.status(404).json({ message: 'Risk profile not found' });
      }

      res.status(200).json(updatedRiskProfile);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  // Delete risk profile
  deleteRiskProfile: async (req, res) => {
    try {
      const deletedRiskProfile = await ProjectRiskProfile.findOneAndDelete({ 
        projectId: req.params.projectId 
      });

      if (!deletedRiskProfile) {
        return res.status(404).json({ message: 'Risk profile not found' });
      }

      res.status(200).json({ message: 'Risk profile deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Add issue to risk profile
  addIssue: async (req, res) => {
    try {
      const riskProfile = await ProjectRiskProfile.findOne({ projectId: req.params.projectId });
      
      if (!riskProfile) {
        return res.status(404).json({ message: 'Risk profile not found' });
      }

      riskProfile.issues.push(req.body.issueId);
      await riskProfile.save();

      res.status(200).json(riskProfile);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  // Remove issue from risk profile
  removeIssue: async (req, res) => {
    try {
      const riskProfile = await ProjectRiskProfile.findOne({ projectId: req.params.projectId });
      
      if (!riskProfile) {
        return res.status(404).json({ message: 'Risk profile not found' });
      }

      riskProfile.issues = riskProfile.issues.filter(
        issue => issue.toString() !== req.params.issueId
      );
      
      await riskProfile.save();

      res.status(200).json(riskProfile);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
};

module.exports = projectRiskProfileController; 