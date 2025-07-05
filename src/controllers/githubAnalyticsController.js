const fetchGitHubReviews = require('../services/analytics/fetchGithubReviews');

const getGitHubReviews = async (req, res) => {
  const org = 'OneCommunityGlobal';
  const repos = ['HighestGoodNetworkApp', 'HGNRest'];

  try {
    let combinedResults = [];

    for (const repo of repos) {
      const data = await fetchGitHubReviews(org, repo);
      combinedResults = combinedResults.concat(data);
    }

    res.status(200).json(combinedResults);
  } catch (err) {
    console.error('Error in controller:', err);
    res.status(500).json({ error: 'Failed to fetch GitHub review data' });
  }
};

module.exports = {
  getGitHubReviews,
};
