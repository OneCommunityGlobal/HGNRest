const mongoose = require('mongoose');
const ProjectRiskProfile = require('../../models/bmdashboard/projectRiskProfile');
const BuildingProject = require('../../models/bmdashboard/buildingProject');
const BuildingIssue = require('../../models/bmdashboard/buildingIssue');

const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24;
const DECIMAL_PLACES = 2;

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

function buildRiskResult(project, profile, totalOpenIssues, now) {
  const baseResult = {
    _id: project._id,
    projectId: project._id,
    projectName: project.name,
    predictedCostOverrun: null,
    predictedTimeDelay: null,
    totalOpenIssues,
    dates: [],
  };
  if (!profile) return baseResult;

  const startDate = new Date(profile.startDate);
  const endDate = new Date(profile.endDate);
  const totalDuration = endDate - startDate;
  const elapsed = now - startDate;
  const percentElapsed = totalDuration > 0 ? (elapsed / totalDuration) * 100 : 0;
  const predictedCostOverrun =
    profile.initialCostEstimate > 0 && percentElapsed > 0
      ? ((profile.currentCostIncurred || 0) / profile.initialCostEstimate) * percentElapsed - 100
      : null;
  const plannedTime = profile.plannedTime || Math.round(totalDuration / MILLISECONDS_PER_DAY);
  const actualTimeElapsed =
    profile.actualTimeElapsed ||
    Math.round(((now < endDate ? now : endDate) - startDate) / MILLISECONDS_PER_DAY);

  return {
    ...baseResult,
    predictedCostOverrun:
      predictedCostOverrun === null
        ? null
        : Number(predictedCostOverrun.toFixed(DECIMAL_PLACES)),
    predictedTimeDelay:
      plannedTime > 0 && actualTimeElapsed > 0 ? (actualTimeElapsed / plannedTime) * 100 : null,
    dates: [profile.startDate, profile.endDate]
      .filter(Boolean)
      .map((date) => new Date(date).toISOString().slice(0, 10)),
  };
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
      const projectFilter = { isActive: { $ne: false } };
      if (projects) {
        const projectIds = projects
          .split(',')
          .map((id) => id.trim())
          .filter((id) => mongoose.Types.ObjectId.isValid(id));
        projectFilter._id = { $in: projectIds };
      }

      const buildingProjects = await BuildingProject.find(projectFilter).sort({ name: 1 }).lean();
      const buildingProjectIds = buildingProjects.map((project) => project._id);
      const profileFilter = { projectId: { $in: buildingProjectIds } };
      if (dates) {
        const [start, end] = dates.split(',');
        profileFilter.startDate = { $gte: new Date(start) };
        profileFilter.endDate = { $lte: new Date(end) };
      }

      const issueFilter = { projectId: { $in: buildingProjectIds }, status: { $ne: 'closed' } };
      if (createdAtRange) issueFilter.issueDate = createdAtRange;
      const [riskProfiles, openIssues] = await Promise.all([
        ProjectRiskProfile.find(profileFilter).lean(),
        BuildingIssue.find(issueFilter).select('projectId').lean(),
      ]);
      const profileByProject = new Map(
        riskProfiles.map((profile) => [String(profile.projectId), profile]),
      );
      const issueCountByProject = openIssues.reduce((counts, issue) => {
        const projectId = String(issue.projectId);
        counts.set(projectId, (counts.get(projectId) || 0) + 1);
        return counts;
      }, new Map());
      const now = new Date();
      const results = buildingProjects.map((project) =>
        buildRiskResult(
          project,
          profileByProject.get(String(project._id)),
          issueCountByProject.get(String(project._id)) || 0,
          now,
        ),
      );
      res.status(200).json(results);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },
};

module.exports = projectRiskProfileController;
