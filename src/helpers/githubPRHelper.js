// eslint-disable-next-line import/no-extraneous-dependencies
const fetch = require('node-fetch');

function createGitHubClient({ owner, repo }) {
  const headers = {
    'X-GitHub-Api-Version': '2022-11-28',
    Accept: 'application/json',
  };
  // eslint-disable-next-line import/no-extraneous-dependencies
  const headerParser = require('parse-link-header');

  async function fetchAllPages(url, isListResponse = true) {
    const result = [];
    while (url) {
      // eslint-disable-next-line no-await-in-loop
      const res = await fetch(url, { headers });

      if (!res.ok) {
        // eslint-disable-next-line no-await-in-loop
        const errorBody = await res.text();
        throw new Error(`GitHub API error ${res.status}: ${res.statusText} - ${errorBody}`);
      }

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
    const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/reviews`;

    try {
      const data = await fetchAllPages(url);
      console.log(data.length);
      return data;
    } catch (err) {
      console.error(`Failed to fetch reviews for PR #${prNumber}:`, err.message);
      throw err;
    }
  }

  async function fetchPullRequests() {
    const url = `https://api.github.com/repos/${owner}/${repo}/pulls`;

    try {
      const data = await fetchAllPages(url);
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
//   // const data = await client.fetchPullRequests();
//   const data = await client.fetchRecentUpdatedPR('2025-07-24T21:00:00Z');
//   for (const item of data) {
//     console.log (item.title, item.number);
//   }
//   console.log (data.length);
// })();
