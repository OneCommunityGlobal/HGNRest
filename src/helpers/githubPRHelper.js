// eslint-disable-next-line import/no-extraneous-dependencies
const fetch = require('node-fetch');
const { RateLimitedError } = require('../utilities/errorHandling/customError');

function createGitHubClient({ owner, repo }) {
  const headers = {
    'X-GitHub-Api-Version': '2022-11-28',
    Accept: 'application/json',
    Authorization: `token ${process.env.GITHUB_TOKEN}`,
  };

  // For testing purpose
  const testing = false;
  const noItemReturn = 3;

  // eslint-disable-next-line import/no-extraneous-dependencies
  const headerParser = require('parse-link-header');

  async function safeFetch(url, isListResponse, maxRetryAttempt, attempt = 1) {
    const res = await fetch(url, { headers });
    // Success
    if (res.ok) return res;

    // Retry if rate limited
    if (res.status === 429 || res.status === 403) {
      let retryAfterSeconds = 60; // default to 1 min
      const retryAfterHeader = res.headers.get('retry-after');
      const rateLimitRemaining = res.headers.get('x-ratelimit-remaining');
      const rateLimitReset = res.headers.get('x-ratelimit-reset');

      // if retry-after header is present
      if (retryAfterHeader) {
        retryAfterSeconds = parseInt(retryAfterHeader, 10);
      } else if (rateLimitRemaining === '0' && rateLimitReset) {
        // reset is UTC epoch seconds
        const resetEpoch = parseInt(rateLimitReset, 10) * 1000; // Convert to ms
        const now = Date.now();
        retryAfterSeconds = Math.max(0, Math.ceil((resetEpoch - now) / 1000));
      }

      // Add jitter to prevent thundering herd: random number 0–59
      const jitter = Math.floor(Math.random() * 60);
      retryAfterSeconds += jitter;
      console.warn(`Rate limit hit. Should retry after waiting ${retryAfterSeconds}s...`);
      // Not gonna retry if the process has to wait for more than 5 minutes
      if (retryAfterSeconds > 300) {
        throw new RateLimitedError(`GitHub API rate limit hit, retry after ${retryAfterSeconds}`);
      }

      // Only retry maxRetryAttempt times (in normal case maxRetryAttempt=2), in case of parallel requests need retry too
      if (attempt >= maxRetryAttempt) {
        throw new RateLimitedError(`GitHub API rate limit hit, retry after ${retryAfterSeconds}`);
      }

      console.warn(`Rate limit hit. Attempt to retry after waiting ${retryAfterSeconds}s...`);

      // eslint-disable-next-line no-promise-executor-return
      await new Promise((resolve) => setTimeout(resolve, retryAfterSeconds * 1000));
      return safeFetch(url, maxRetryAttempt, attempt + 1); // retry
    }

    // Cannot find the item, it probably has been deleted and don't need to retry
    if (res.status === 404) {
      if (isListResponse) return [];
      return { items: [] };
    }
    // Throw error if there are any other errors
    const errorBody = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${res.statusText} - ${errorBody}`);
  }

  async function fetchAllPages(url, isListResponse) {
    const result = [];
    while (url) {
      // eslint-disable-next-line no-await-in-loop
      const res = await safeFetch(url, isListResponse, 2, 1);

      // eslint-disable-next-line no-await-in-loop
      const data = await res.json();

      if (isListResponse) {
        result.push(...data);
      } else {
        result.push(...data.items);
      }

      url = null;
      const linkHeader = res.headers.get('link');
      if (linkHeader) {
        const linkHeaderParsed = headerParser(linkHeader);
        if (linkHeaderParsed.next) {
          url = linkHeaderParsed.next.url;
        }
      }
    }
    return result;
  }

  async function fetchReviews(prNumber) {
    const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/reviews?per_page=100`;

    try {
      // console.log (url);
      const data = await fetchAllPages(url, true);
      if (testing) {
        return data.slice(0, noItemReturn); // return only 2 items for testing
      }
      return data;
    } catch (err) {
      console.error(`Failed to fetch reviews for PR #${prNumber}:`, err.message);
      throw err;
    }
  }

  async function fetchPullRequests() {
    const url = `https://api.github.com/repos/${owner}/${repo}/pulls?per_page=100`;

    try {
      const data = await fetchAllPages(url, true);
      if (testing) {
        return data.slice(0, noItemReturn); // return only 2 items for testing
      }
      return data;
    } catch (err) {
      console.error(`Failed to fetch pull requests for repo ${repo}:`, err.message);
      throw err;
    }
  }

  async function fetchRecentUpdatedPR(sinceDate) {
    const url = `https://api.github.com/search/issues?q=repo:${owner}/${repo}+type:pr+updated:>=${sinceDate}&sort=updated&order=desc`;
    try {
      const data = await fetchAllPages(url, false);
      if (testing) {
        return data.slice(0, noItemReturn); // return only 2 items for testing
      }
      return data;
    } catch (err) {
      console.error(`Failed to fetch pull requests for repo ${repo}:`, err.message);
      throw err;
    }
  }

  return {
    fetchReviews,
    fetchPullRequests,
    fetchRecentUpdatedPR,
  };
}

module.exports = createGitHubClient;

// const client = createGitHubClient({
//   owner: 'OneCommunityGlobal',
//   repo: 'HighestGoodNetworkApp',
// });

// (async () => {
//   // const reviews = await client.fetchReviews(3775);
//   const data = await client.fetchPullRequests();
//   console.log (data);
//   // const data = await client.fetchRecentUpdatedPR('2025-07-24T21:00:00Z');
//   // for (const item of data) {
//   //   console.log (item.title, item.number);
//   // }
//   // console.log (data.length);
// })();
