// v1.1.0
const ProjectRiskProfile = require('../../models/bmdashboard/projectRiskProfile');
const Issue = require('../../models/bmdashboard/Issues');
const Observation = require('../../models/bmdashboard/projectRiskObservation');
const { calculateRiskMetrics } = require('../../utilities/projectRiskMetrics');
const { issueCount, recordObservation } = require('../../services/projectRiskHistory');
const logger = require('../../startup/logger');

async function validateIssueReferences(projectId, issues = []) {
  if (!Array.isArray(issues)) throw new Error('Issues must be an array of issue IDs');
  const ids = [...new Set([String(projectId), ...issues.map(String)])];
  if (ids.some((id) => !/^[a-f0-9]{24}$/i.test(id))) throw new Error('Invalid project or issue ID');
  const found = await Issue.find({ _id: { $in: ids } })
    .select('_id')
    .lean();
  if (found.length !== ids.length) throw new Error('Project or issue record not found');
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
      await validateIssueReferences(req.body.projectId, req.body.issues);
      if (await ProjectRiskProfile.exists({ projectId: req.body.projectId })) {
        return res.status(409).json({ message: 'Risk profile already exists for this project' });
      }
      // Canonical IDs make concurrent creates unique without reindexing legacy profiles.
      const riskProfile = new ProjectRiskProfile({
        ...profileInput(req.body),
        _id: req.body.projectId,
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
        projectId: req.params.projectId,
      });
      if (!updatedRiskProfile) return res.status(404).json({ message: 'Risk profile not found' });
      const changes = profileInput(req.body);
      delete changes.projectId;
      updatedRiskProfile.set(changes);
      await validateIssueReferences(updatedRiskProfile.projectId, updatedRiskProfile.issues);
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
      const results = await Promise.all(
        riskProfiles.map(async (profile) => {
          const metrics = calculateRiskMetrics(profile, now);
          const issueDoc = await Issue.findById(profile.projectId).lean();
          const totalOpenIssues = await issueCount(profile, createdAtRange);
          return {
            _id: profile._id,
            projectId: profile.projectId,
            status: profile.status || 'unknown',
            asOf: now.toISOString(),
            history: histories.get(String(profile._id)) || [],
            projectName: issueDoc ? issueDoc.projectName : '',
            ...metrics,
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
