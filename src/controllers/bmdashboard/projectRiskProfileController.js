// v1.2.0
const mongoose = require('mongoose');
const ProjectRiskProfile = require('../../models/bmdashboard/projectRiskProfile');
const BuildingProject = require('../../models/bmdashboard/buildingProject');
const BuildingIssue = require('../../models/bmdashboard/buildingIssue');
const Observation = require('../../models/bmdashboard/projectRiskObservation');
const { calculateRiskMetrics } = require('../../utilities/projectRiskMetrics');
const { recordObservation } = require('../../services/projectRiskHistory');
const logger = require('../../startup/logger');

function parseProjectId(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{24}$/i.test(value)) {
    throw new Error('Invalid project ID');
  }
  return mongoose.Types.ObjectId(value);
}

async function validateProfileReferences(projectId, issues = []) {
  if (!Array.isArray(issues)) throw new Error('Issues must be an array of issue IDs');
  const ids = [...new Set(issues.map(String))];
  if (ids.some((id) => !/^[a-f0-9]{24}$/i.test(id))) throw new Error('Invalid issue ID');
  if (!(await BuildingProject.exists({ _id: projectId }))) {
    throw new Error('Building project not found');
  }
  const found = await BuildingIssue.countDocuments({ _id: { $in: ids }, projectId });
  if (found !== ids.length) throw new Error('Issue record not found for this building project');
}

// A failed history write must not report an already-saved profile as a failed mutation.
const recordChange = (profile) =>
  recordObservation(profile).catch((error) => {
    logger.logException(error, 'Risk profile saved; daily job will retry its observation');
  });
const PROFILE_FIELDS = [
  'projectId',
  'startDate',
  'endDate',
  'initialCostEstimate',
  'currentCostIncurred',
  'issues',
  'plannedTime',
  'actualTimeElapsed',
  'status',
  'completedAt',
];
const profileInput = (body) =>
  Object.fromEntries(
    PROFILE_FIELDS.filter((key) => body[key] !== undefined).map((key) => [key, body[key]]),
  );

// Build an issueDate filter from optional YYYY-MM-DD start/end query params.
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
      const projectId = parseProjectId(req.body.projectId);
      await validateProfileReferences(projectId, req.body.issues);
      if (await ProjectRiskProfile.exists({ projectId })) {
        return res.status(409).json({ message: 'Risk profile already exists for this project' });
      }
      // Canonical IDs make concurrent creates unique without reindexing legacy profiles.
      const riskProfile = new ProjectRiskProfile({
        ...profileInput(req.body),
        projectId,
        _id: projectId,
      });
      const savedRiskProfile = await riskProfile.save();
      await recordChange(savedRiskProfile);
      res.status(201).json(savedRiskProfile);
    } catch (error) {
      if (error.code === 11000)
        return res.status(409).json({ message: 'Risk profile already exists for this project' });
      res.status(400).json({ message: error.message });
    }
  },

  // Update risk profile
  updateRiskProfile: async (req, res) => {
    try {
      const updatedRiskProfile = await ProjectRiskProfile.findOne({
        projectId: parseProjectId(req.params.projectId),
      });
      if (!updatedRiskProfile) return res.status(404).json({ message: 'Risk profile not found' });
      const changes = profileInput(req.body);
      delete changes.projectId;
      updatedRiskProfile.set(changes);
      await validateProfileReferences(updatedRiskProfile.projectId, updatedRiskProfile.issues);
      await updatedRiskProfile.save();
      await recordChange(updatedRiskProfile);

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

      await Observation.deleteMany({ profileId: deletedRiskProfile._id });
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
      await recordChange(riskProfile);

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
      await recordChange(riskProfile);

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
      const historyStart = new Date(now.getTime() - 365 * 86400000);
      historyStart.setUTCHours(0, 0, 0, 0);
      const observations = await Observation.find({
        profileId: { $in: riskProfiles.map((p) => p._id) },
        date: { $gte: historyStart, $lte: now },
      })
        .sort({ date: 1 })
        .lean();
      const histories = new Map();
      observations.forEach((observation) => {
        const key = String(observation.profileId);
        if (!histories.has(key)) histories.set(key, []);
        histories.get(key).push(observation);
      });
      const results = buildingProjects.map((project) => {
        const profile = profileByProject.get(String(project._id));
        return {
          _id: profile ? profile._id : project._id,
          projectId: project._id,
          projectName: project.name,
          status: profile?.status || 'unknown',
          asOf: now.toISOString(),
          history: profile ? histories.get(String(profile._id)) || [] : [],
          ...(profile
            ? calculateRiskMetrics(profile, now)
            : { predictedCostOverrun: null, predictedTimeDelay: null }),
          totalOpenIssues: issueCountByProject.get(String(project._id)) || 0,
          dates: profile
            ? [profile.startDate, profile.endDate]
                .filter(Boolean)
                .map((date) => new Date(date).toISOString().slice(0, 10))
            : [],
        };
      });
      res.status(200).json(results);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },
};

module.exports = projectRiskProfileController;
