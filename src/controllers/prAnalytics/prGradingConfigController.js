const prGradingConfigController = function (PRGradingConfig, UserProfile, HgnFormResponse, Team) {
  // Maps weeklycommittedHours to required PR count
  const getPrsNeeded = (weeklyHours) => {
    if (weeklyHours >= 35) return 30;
    if (weeklyHours >= 26) return 20;
    if (weeklyHours >= 15) return 10;
    if (weeklyHours >= 10) return 7;
    return 0;
  };

  // Syncs reviewerNames in prGradingConfigs based on:
  // - Users who have submitted the Skills Questionnaire (hgnFormResponses)
  // - Excluding users already on a dev team (teams.members)
  // - Split A-M -> Team 1, N-Z -> Team 2
  const syncReviewers = async (req, res) => {
    try {
      // Step 1: Get all user_ids from hgnFormResponses
      const formResponses = await HgnFormResponse.find(
        { user_id: { $exists: true, $ne: null } },
        { user_id: 1 },
      ).lean();
      const sqUserIds = formResponses.map((r) => r.user_id.toString());

      if (sqUserIds.length === 0) {
        return res.status(200).json({ message: 'No SQ responses found', team1: [], team2: [] });
      }

      // Step 2: Get all userIds already on a dev team
      const teams = await Team.find({}, { 'members.userId': 1 }).lean();
      const promotedUserIds = new Set(
        teams.flatMap((t) => t.members.map((m) => m.userId.toString())),
      );

      // Step 3: Filter SQ users who are NOT yet promoted
      const pendingUserIds = sqUserIds.filter((id) => !promotedUserIds.has(id));

      if (pendingUserIds.length === 0) {
        return res.status(200).json({ message: 'All SQ users are promoted', team1: [], team2: [] });
      }

      // Step 4: Look up userProfile for pending users
      const profiles = await UserProfile.find(
        { _id: { $in: pendingUserIds } },
        { firstName: 1, lastName: 1, weeklycommittedHours: 1 },
      ).lean();

      // Step 5: Split by lastName first char A-M / N-Z
      const team1Reviewers = [];
      const team2Reviewers = [];

      profiles.forEach((profile) => {
        const firstChar = (profile.lastName || '').charAt(0).toUpperCase();
        const reviewerName = `${profile.firstName} ${profile.lastName}`.trim();
        const prsNeeded = getPrsNeeded(profile.weeklycommittedHours || 10);

        if (firstChar >= 'A' && firstChar <= 'M') {
          team1Reviewers.push({ name: reviewerName, prsNeeded });
        } else if (firstChar >= 'N' && firstChar <= 'Z') {
          team2Reviewers.push({ name: reviewerName, prsNeeded });
        }
        // names starting with non-alpha chars are ignored — handle manually
      });

      // Step 6: Upsert prGradingConfigs for Team 1 and Team 2
      await PRGradingConfig.findOneAndUpdate(
        { teamName: 'Team 1' },
        {
          $set: {
            reviewerNames: team1Reviewers.map((r) => r.name),
            reviewerCount: team1Reviewers.length,
          },
        },
        { upsert: true, new: true },
      );

      await PRGradingConfig.findOneAndUpdate(
        { teamName: 'Team 2' },
        {
          $set: {
            reviewerNames: team2Reviewers.map((r) => r.name),
            reviewerCount: team2Reviewers.length,
          },
        },
        { upsert: true, new: true },
      );

      return res.status(200).json({
        message: 'Reviewer sync complete',
        team1: team1Reviewers,
        team2: team2Reviewers,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error syncing reviewers:', err);
      return res.status(500).json({ error: 'Failed to sync reviewers', details: err.message });
    }
  };
  const getAllConfigs = async (req, res) => {
    try {
      const configs = await PRGradingConfig.find().sort({ createdAt: -1 });
      res.status(200).json(configs);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch configurations', details: err.message });
    }
  };

  const createConfig = async (req, res) => {
    try {
      const { teamName, reviewerCount, testDataType, reviewerNames, notes } = req.body;

      if (!teamName || !reviewerCount || !testDataType) {
        return res
          .status(400)
          .json({ error: 'teamName, reviewerCount, and testDataType are required.' });
      }

      if (typeof reviewerCount !== 'number' || reviewerCount < 1) {
        return res.status(400).json({ error: 'reviewerCount must be a positive number.' });
      }

      const existing = await PRGradingConfig.findOne({ teamName: teamName.trim() });
      if (existing) {
        return res
          .status(409)
          .json({ error: `A configuration with team name "${teamName}" already exists.` });
      }

      const newConfig = new PRGradingConfig({
        teamName: teamName.trim(),
        reviewerCount,
        testDataType,
        reviewerNames: reviewerNames || [],
        notes: notes || '',
      });

      const saved = await newConfig.save();
      res.status(201).json(saved);
    } catch (err) {
      res.status(500).json({ error: 'Failed to create configuration', details: err.message });
    }
  };

  const deleteConfig = async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await PRGradingConfig.findByIdAndDelete(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Configuration not found.' });
      }
      res.status(200).json({ message: 'Configuration deleted successfully.' });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete configuration', details: err.message });
    }
  };

  return { getAllConfigs, createConfig, deleteConfig, syncReviewers };
};

module.exports = prGradingConfigController;
