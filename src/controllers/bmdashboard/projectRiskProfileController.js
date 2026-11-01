const ProjectRiskProfile = require('../../models/bmdashboard/projectRiskProfile');
const Issue = require('../../models/bmdashboard/Issues');

// Build a createdAt filter from optional YYYY-MM-DD start/end query params.
function buildCreatedAtRange(start, end) {
  const range = {};
  const startDate = start ? new Date(start) : null;
  const endDate = end ? new Date(end) : null;
  if (startDate && Number.isFinite(startDate.getTime())) range.$gte = startDate;
  if (endDate && Number.isFinite(endDate.getTime())) {
    endDate.setUTCHours(23, 59, 59, 999);
    range.$lte = endDate;
  }
  return Object.keys(range).length ? range : null;
}

function sumIssueCounts(issueDocs) {
  return issueDocs.reduce(
    (sum, doc) =>
      sum + (doc.equipmentIssues || 0) + (doc.laborIssues || 0) + (doc.materialIssues || 0),
    0,
  );
}

const projectRiskProfileController = {
  // Get all risk profiles
  getAllRiskProfiles: async (req, res) => {
    try {
      const riskProfiles = await ProjectRiskProfile.find().populate('issues').lean();
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
        issues: req.body.issues,
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
            issues: req.body.issues,
          },
        },
        { new: true },
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
        projectId: req.params.projectId,
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
        (issue) => issue.toString() !== req.params.issueId,
      );

      await riskProfile.save();

      res.status(200).json(riskProfile);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  },

  // Get risk profile summary for dashboard
  getRiskProfileSummary: async (req, res) => {
    try {
      const { dates, projects, startDate: rangeStart, endDate: rangeEnd } = req.query;
      const createdAtRange = buildCreatedAtRange(rangeStart, rangeEnd);
      const filter = {};
      if (projects) {
        // projects can be a comma-separated list of Issue IDs
        const projectIds = projects.split(',').map((id) => id.trim());
        filter.projectId = { $in: projectIds };
      }
      if (dates) {
        // dates can be a comma-separated pair: start,end
        const [start, end] = dates.split(',');
        filter.startDate = { $gte: new Date(start) };
        filter.endDate = { $lte: new Date(end) };
      }
      // No population needed; projectId is the Issue _id
      const riskProfiles = await ProjectRiskProfile.find(filter).lean();
      const now = new Date();
      const results = await Promise.all(
        riskProfiles.map(async (profile) => {
          // Cost Overrun Calculation
          const initialCost = profile.initialCostEstimate || 0;
          const currentCost = profile.currentCostIncurred || 0;
          const startDate = new Date(profile.startDate);
          const endDate = new Date(profile.endDate);
          const totalDuration = endDate - startDate;
          const elapsed = now - startDate;
          const percentElapsed = totalDuration > 0 ? (elapsed / totalDuration) * 100 : 0;
          let predictedCostOverrun = null;
          if (initialCost > 0 && percentElapsed > 0) {
            predictedCostOverrun = (currentCost / initialCost) * percentElapsed - 100;
          }
          // Calculate plannedTime and actualTimeElapsed if not provided
          const plannedTime =
            profile.plannedTime || Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));
          const actualTimeElapsed =
            profile.actualTimeElapsed ||
            Math.round(((now < endDate ? now : endDate) - startDate) / (1000 * 60 * 60 * 24));
          // Time Delay Calculation
          let predictedTimeDelay = null;
          if (plannedTime > 0 && actualTimeElapsed > 0) {
            predictedTimeDelay = (actualTimeElapsed / plannedTime) * 100;
          }
          // Issue document for the project name (projectId is the Issue _id)
          const issueDoc = await Issue.findById(profile.projectId).lean();
          // Issue records for this project; when a time range is given, only
          // count records created within it.
          const issueIds = (profile.issues || []).length ? profile.issues : [profile.projectId];
          const issueQuery = { _id: { $in: issueIds } };
          if (createdAtRange) issueQuery.createdAt = createdAtRange;
          const issueDocs = await Issue.find(issueQuery).lean();
          const totalOpenIssues = sumIssueCounts(issueDocs);
          return {
            projectName: issueDoc ? issueDoc.projectName : '',
            predictedCostOverrun:
              predictedCostOverrun !== null ? Number(predictedCostOverrun.toFixed(2)) : null,
            predictedTimeDelay,
            totalOpenIssues,
            dates: [
              profile.startDate ? new Date(profile.startDate).toISOString().slice(0, 10) : null,
              profile.endDate ? new Date(profile.endDate).toISOString().slice(0, 10) : null,
            ].filter(Boolean),
          };
        }),
      );
      res.status(200).json(results);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },
};

module.exports = projectRiskProfileController;
