const axios = require('axios');
const dayjs = require('dayjs');
const NodeCache = require('node-cache');

/**
 * Controller for user skills profile operations
 *
 * @param {Object} HgnFormResponses - The HgnFormResponses model
 * @param {Object} UserProfile - The UserProfile model
 * @returns {Object} Controller methods
 */

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const BASE_URL = 'https://api.github.com';
const cache = new NodeCache({ stdTTL: 3600 }); // Cache for 1 hour



const fetchGitHubReviews = (HgnFormResponses, UserProfile) => async (org, repo, duration = 'allTime', sort = 'desc') => {
  const cacheKey = `${org}_${repo}_${duration}_${sort}`;
  const cachedData = cache.get(cacheKey);
  if (cachedData) {
    return cachedData;
  }

  const headers = {
    Authorization: `token ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
  };

  const now = dayjs();
  const durationMap = {
    lastWeek: now.subtract(7, 'day'),
    last2weeks: now.subtract(14, 'day'),
    lastMonth: now.subtract(30, 'day'),
    allTime: dayjs('2000-01-01'), // default fallback to include everything
  };
  const startDate = durationMap[duration] || durationMap.allTime;

  try {
    let allPRs = [];
    let page = 1;
    const maxPRs = 200; // To avoid overloading the API and UI
    let hasMore = true;

    // Fetch PR's paginated to handle more than 100 results
    while (hasMore && allPRs.length < maxPRs) {
      const prsResponse = await axios.get(
        `${BASE_URL}/repos/${org}/${repo}/pulls?state=all&per_page=100&page=${page}`,
        { headers }
      );
      const prData = prsResponse.data;
      allPRs = allPRs.concat(prData);
      hasMore = prData.length === 100;
      page++;
    }
    allPRs = allPRs.slice(0, maxPRs);

    // Use Promise.all to fetch reviews in parallel
    const reviewPromises = allPRs.map(async (pr) => {
      try {
        const reviewsResponse = await axios.get(
          `${BASE_URL}/repos/${org}/${repo}/pulls/${pr.number}/reviews`,
          { headers }
        );
        const reviews = reviewsResponse.data;
        return reviews.map((review) => {
          const reviewer = review.user?.login || 'Unknown';
          const state = review.state;
          const submittedAt = review.submitted_at;

          if (!reviewer || !submittedAt || !state) return null;

          const reviewDate = dayjs(submittedAt);
          if (reviewDate.isBefore(startDate)) return null;

          return { reviewer, state };
        }).filter(Boolean);
      } catch (err) {
        console.error(`Failed to fetch reviews for PR #${pr.number}:`, err.message);
        return [];
      }
    });

    const reviewArrays = await Promise.all(reviewPromises);
    const allReviewData = reviewArrays.flat();

    const reviewerSummary = {};

    const fetchMentorAndTeamInfo = async (githubUsername) => {
      try {
        const formResponse = await HgnFormResponses.findOne({
          'userInfo.github': githubUsername,
        }).lean();



        if (!formResponse) return null;

        const userId = formResponse.user_id;

        const userProfile = await UserProfile.findById(userId)
          .populate({
            path: 'teams',
            select: '_id teamName',
          })
          .lean();

        const isMentor =
          typeof userProfile.role === 'string' &&
          userProfile.role.toLowerCase() === 'mentor';

        console.log('isMentor' + isMentor);
        console.log(userProfile.teamCode);

        return {
          isMentor,
          team: userProfile.teamCode || null,
        };
      } catch (err) {
        console.error(`Failed to fetch mentor/team info for ${githubUsername}:`, err.message);
        return null;
      }
    };



    for (const { reviewer, state } of allReviewData) {
      if (!reviewer) continue;

      if (!reviewerSummary[reviewer]) {

        // const responses = await HgnFormResponses.find({}).lean();
        // console.log(JSON.stringify(responses, null, 2));
        const extraInfo = await fetchMentorAndTeamInfo(reviewer);
        console.log(extraInfo);

        reviewerSummary[reviewer] = {
          reviewer,
          isMentor: extraInfo?.isMentor ?? null,
          team: extraInfo?.team ?? null,
          counts: {
            Exceptional: 0,
            Sufficient: 0,
            'Needs Changes': 0,
            'Did Not Review': 0,
          },
        };
      }

      const mappedState =
        state === 'APPROVED' ? 'Sufficient'
          : state === 'CHANGES_REQUESTED' ? 'Needs Changes'
            : state === 'COMMENTED' ? 'Exceptional'
              : 'Did Not Review';

      reviewerSummary[reviewer].counts[mappedState]++;
    }


    const result = Object.values(reviewerSummary).sort((a, b) => {
      const aTotal = Object.values(a.counts).reduce((acc, val) => acc + val, 0);
      const bTotal = Object.values(b.counts).reduce((acc, val) => acc + val, 0);
      return sort === 'asc' ? aTotal - bTotal : bTotal - aTotal;
    });

    cache.set(cacheKey, result);
    return result;
  } catch (err) {
    console.error('Error fetching data from GitHub:', err.response?.data || err.message);
    return [];
  }
};

module.exports = fetchGitHubReviews;
