const axios = require('axios');
const dayjs = require('dayjs');
const NodeCache = require('node-cache');

const { GITHUB_TOKEN } = process.env;
const BASE_URL = 'https://api.github.com';
const cache = new NodeCache({ stdTTL: 3600 }); // Cache for 1 hour

const EMPTY_COUNTS = () => ({
  Exceptional: 0,
  Sufficient: 0,
  'Needs Changes': 0,
  'Did Not Review': 0,
});

const normalizeGithubUsername = (value) => {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const withoutUrl = trimmed
    .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
    .replace(/^@/, '')
    .split('/')[0]
    .split('?')[0];

  return withoutUrl.toLowerCase() || null;
};

const mapReviewState = (state) => {
  if (state === 'APPROVED') return 'Sufficient';
  if (state === 'CHANGES_REQUESTED') return 'Needs Changes';
  if (state === 'COMMENTED') return 'Exceptional';
  return 'Did Not Review';
};

/**
 * Fetch and aggregate GitHub PR review data for a single repo.
 * Team filter and sort are applied in the controller after merging repos.
 *
 * @param {Object} HgnFormResponses
 * @param {Object} UserProfile
 * @returns {Function}
 */
const fetchGitHubReviews =
  (HgnFormResponses, UserProfile) =>
  async (org, repo, duration = 'allTime') => {
    const cacheKey = `${org}_${repo}_${duration}`;
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
      allTime: dayjs('2000-01-01'),
    };
    const startDate = durationMap[duration] || durationMap.allTime;

    try {
      let allPRs = [];
      let page = 1;
      const maxPRs = 200;
      let hasMore = true;

      while (hasMore && allPRs.length < maxPRs) {
        // eslint-disable-next-line no-await-in-loop
        const prsResponse = await axios.get(
          `${BASE_URL}/repos/${org}/${repo}/pulls?state=all&per_page=100&page=${page}`,
          { headers },
        );
        const prData = prsResponse.data;
        allPRs = allPRs.concat(prData);
        hasMore = prData.length === 100;
        page += 1;
      }
      allPRs = allPRs.slice(0, maxPRs);

      const reviewPromises = allPRs.map(async (pr) => {
        try {
          const reviewsResponse = await axios.get(
            `${BASE_URL}/repos/${org}/${repo}/pulls/${pr.number}/reviews`,
            { headers },
          );

          return reviewsResponse.data
            .map((review) => {
              const reviewer = review.user?.login;
              const { state } = review;
              const submittedAt = review.submitted_at;

              if (!reviewer || !submittedAt || !state) return null;
              if (dayjs(submittedAt).isBefore(startDate)) return null;

              return { reviewer, state };
            })
            .filter(Boolean);
        } catch (err) {
          console.error(`Failed to fetch reviews for PR #${pr.number}:`, err.message);
          return [];
        }
      });

      const allReviewData = (await Promise.all(reviewPromises)).flat();
      const uniqueReviewers = [...new Set(allReviewData.map((r) => r.reviewer))];

      // Batch-load form responses and profiles so team lookup is reliable and not N+1.
      const formResponses = await HgnFormResponses.find({
        'userInfo.github': { $exists: true, $nin: [null, ''] },
      })
        .select('userInfo.github user_id')
        .lean();

      const githubToUserId = new Map();
      formResponses.forEach((form) => {
        const normalized = normalizeGithubUsername(form.userInfo?.github);
        if (normalized && form.user_id) {
          githubToUserId.set(normalized, form.user_id);
        }
      });

      const matchedUserIds = uniqueReviewers
        .map((name) => githubToUserId.get(normalizeGithubUsername(name)))
        .filter(Boolean);

      const userProfiles = matchedUserIds.length
        ? await UserProfile.find({ _id: { $in: matchedUserIds } })
            .select('teamCode')
            .lean()
        : [];

      const userIdToTeam = new Map(
        userProfiles.map((profile) => [
          String(profile._id),
          profile.teamCode && String(profile.teamCode).trim()
            ? String(profile.teamCode).trim()
            : null,
        ]),
      );

      const reviewerSummary = {};

      allReviewData.forEach(({ reviewer, state }) => {
        if (!reviewerSummary[reviewer]) {
          const userId = githubToUserId.get(normalizeGithubUsername(reviewer));
          const team = userId ? userIdToTeam.get(String(userId)) || null : null;

          reviewerSummary[reviewer] = {
            reviewer,
            // Spec: default false until mentor source-of-truth issue is resolved.
            isMentor: false,
            team,
            counts: EMPTY_COUNTS(),
          };
        }

        reviewerSummary[reviewer].counts[mapReviewState(state)] += 1;
      });

      const result = Object.values(reviewerSummary);
      cache.set(cacheKey, result);
      return result;
    } catch (err) {
      console.error('Error fetching data from GitHub:', err.response?.data || err.message);
      return [];
    }
  };

fetchGitHubReviews.clearCache = () => cache.flushAll();

module.exports = fetchGitHubReviews;
