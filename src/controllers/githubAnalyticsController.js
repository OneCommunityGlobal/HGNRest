const fetchGitHubReviews = require('../services/analytics/fetchGithubReviews');

const getGitHubReviews = async (req, res) => {
  const org = 'OneCommunityGlobal';
  const repos = ['HighestGoodNetworkApp', 'HGNRest'];

  const { duration = 'allTime', sort = 'desc', team = null } = req.query;

  try {
    let combinedResults = [];

    const allData = await Promise.all(
      repos.map((repo) => fetchGitHubReviews(org, repo, duration, sort, team))
    );

    combinedResults = allData.flat();

    res.status(200).json(combinedResults);
  } catch (err) {
    console.error('Error in controller:', err);
    res.status(500).json({ error: 'Failed to fetch GitHub review data' });
  }
};

module.exports = {
  getGitHubReviews,
};
