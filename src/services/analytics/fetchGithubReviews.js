
const axios = require('axios');
const dayjs = require('dayjs');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const BASE_URL = 'https://api.github.com';

const fetchGitHubReviews = async (org, repo, duration = 'allTime', sort = 'desc') => {
  const headers = {
    Authorization: `token ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
  };

  const now = dayjs();
  const durationMap = {
    lastWeek: now.subtract(7, 'day'),
    last2weeks: now.subtract(14, 'day'),
    lastMonth: now.subtract(30, 'day'),
    allTime: dayjs('2000-01-01')
  };
  const startDate = durationMap[duration] || durationMap.allTime;

  try {
    const prsResponse = await axios.get(
      `${BASE_URL}/repos/${org}/${repo}/pulls?state=all&per_page=100`,
      { headers }
    );
    const prData = prsResponse.data;

    const allReviewData = [];

    for (const pr of prData) {
      const reviewsResponse = await axios.get(
        `${BASE_URL}/repos/${org}/${repo}/pulls/${pr.number}/reviews`,
        { headers }
      );
      const reviews = reviewsResponse.data;

      for (const review of reviews) {
        const reviewer = review.user?.login || 'Unknown';
        const state = review.state;
        const submittedAt = review.submitted_at;

        if (!reviewer || !submittedAt || !state) continue;

        const reviewDate = dayjs(submittedAt);
        if (reviewDate.isBefore(startDate)) continue;

        allReviewData.push({
          reviewer,
          state,
        });
      }
    }

  
    const reviewerSummary = {};
    allReviewData.forEach(({ reviewer, state }) => {
      if (!reviewerSummary[reviewer]) {
        reviewerSummary[reviewer] = {
          reviewer,
          isMentor: null,
          team: null,
          counts: {
            Exceptional: 0,
            Sufficient: 0,
            'Needs Changes': 0,
            'Did Not Review': 0,
          }
        };
      }

      const mappedState =
        state === 'APPROVED' ? 'Sufficient'
        : state === 'CHANGES_REQUESTED' ? 'Needs Changes'
        : state === 'COMMENTED' ? 'Exceptional'
        : 'Did Not Review';

      reviewerSummary[reviewer].counts[mappedState]++;
    });

    
    const result = Object.values(reviewerSummary).sort((a, b) => {
      const aTotal = Object.values(a.counts).reduce((acc, val) => acc + val, 0);
      const bTotal = Object.values(b.counts).reduce((acc, val) => acc + val, 0);
      return sort === 'asc' ? aTotal - bTotal : bTotal - aTotal;
    });

    return result;
  } catch (err) {
    console.error('Error fetching data from GitHub:', err.response?.data || err.message);
    return [];
  }
};

module.exports = fetchGitHubReviews;
