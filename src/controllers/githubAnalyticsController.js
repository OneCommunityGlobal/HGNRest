const HgnFormResponses = require('../models/hgnFormResponse');
const UserProfile = require('../models/userProfile');
const fetchGitHubReviews = require('../services/analytics/fetchGithubReviews')(
  HgnFormResponses,
  UserProfile,
);

const VALID_DURATIONS = ['lastWeek', 'last2weeks', 'lastMonth', 'allTime'];
const VALID_SORTS = ['asc', 'desc'];

const getTotalReviews = (counts = {}) => Object.values(counts).reduce((acc, val) => acc + val, 0);

const mergeReviewerResults = (repoResults) => {
  const merged = {};

  repoResults.flat().forEach((entry) => {
    if (!entry?.reviewer) return;

    if (!merged[entry.reviewer]) {
      merged[entry.reviewer] = {
        reviewer: entry.reviewer,
        isMentor: entry.isMentor === true,
        team: entry.team || null,
        counts: {
          Exceptional: 0,
          Sufficient: 0,
          'Needs Changes': 0,
          'Did Not Review': 0,
        },
      };
    }

    const target = merged[entry.reviewer];
    target.isMentor = target.isMentor || entry.isMentor === true;
    if (!target.team && entry.team) {
      target.team = entry.team;
    }

    Object.keys(target.counts).forEach((key) => {
      target.counts[key] += entry.counts?.[key] || 0;
    });
  });

  return Object.values(merged);
};

const getGitHubReviews = async (req, res) => {
  const org = 'OneCommunityGlobal';
  const repos = ['HighestGoodNetworkApp', 'HGNRest'];

  const { duration = 'allTime', sort = 'desc', team } = req.query;

  if (duration && !VALID_DURATIONS.includes(duration)) {
    return res.status(400).json({
      error: `Invalid duration. Accepted values: ${VALID_DURATIONS.join(', ')}`,
    });
  }

  if (sort && !VALID_SORTS.includes(sort)) {
    return res.status(400).json({
      error: `Invalid sort. Accepted values: ${VALID_SORTS.join(', ')}`,
    });
  }

  const teamFilter = typeof team === 'string' && team.trim() ? team.trim() : null;

  try {
    const allData = await Promise.all(repos.map((repo) => fetchGitHubReviews(org, repo, duration)));

    let combinedResults = mergeReviewerResults(allData);

    if (teamFilter) {
      const normalizedTeam = teamFilter.toLowerCase();
      combinedResults = combinedResults.filter(
        (entry) => entry.team && entry.team.toLowerCase() === normalizedTeam,
      );
    }

    combinedResults.sort((a, b) => {
      const aTotal = getTotalReviews(a.counts);
      const bTotal = getTotalReviews(b.counts);
      return sort === 'asc' ? aTotal - bTotal : bTotal - aTotal;
    });

    return res.status(200).json(combinedResults);
  } catch (err) {
    console.error('Error in controller:', err);
    return res.status(500).json({ error: 'Failed to fetch GitHub review data' });
  }
};

module.exports = {
  getGitHubReviews,
  mergeReviewerResults,
  getTotalReviews,
  VALID_DURATIONS,
  VALID_SORTS,
};
