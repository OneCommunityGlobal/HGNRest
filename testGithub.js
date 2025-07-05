require('dotenv').config();
const fetchGitHubReviews = require('./src/services/analytics/fetchGitHubReviews');

(async () => {
  const org = 'OneCommunityGlobal';
  const repos = ['HighestGoodNetworkApp', 'HGNRest'];

  let combinedResults = [];

  for (const repo of repos) {
    console.log(`Fetching data from ${repo}`);
    const data = await fetchGitHubReviews(org, repo);
    combinedResults = combinedResults.concat(data); 
  }

  console.log('Combined Review Data:\n', JSON.stringify(combinedResults, null, 2));
})();
