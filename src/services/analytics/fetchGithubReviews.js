const axios = require('axios');

// Replace with your GitHub token or store in env file for security
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const BASE_URL = 'https://api.github.com';

const fetchGitHubReviews = async (org, repo) => {
  const headers = {
    Authorization: `token ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
  };

  try {
    // Step 1: Fetch all PRs
    const prsResponse = await axios.get(
      `${BASE_URL}/repos/${org}/${repo}/pulls?state=all&per_page=100`,
      { headers }
    );

    const prData = prsResponse.data;

    const allReviewData = [];

    //getting PR review details
    for (const pr of prData) {
      const reviewsResponse = await axios.get(
        `${BASE_URL}/repos/${org}/${repo}/pulls/${pr.number}/reviews`,
        { headers }
      );

      const reviews = reviewsResponse.data;

      // Necessary review details
      allReviewData.push({
        prNumber: pr.number,
        reviewerData: reviews.map(r => ({
          reviewer: r.user?.login || 'Unknown',
          state: r.state,
          submitted_at: r.submitted_at,
        }))
      });
    }

    return allReviewData;
  } catch (err) {
    console.error('Error fetching data from GitHub:', err.response?.data || err.message);
    return [];
  }
};

module.exports = fetchGitHubReviews;
