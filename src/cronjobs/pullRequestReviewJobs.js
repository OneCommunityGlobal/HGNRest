// eslint-disable-next-line no-unused-vars
const { CronJob } = require('cron');
const PullRequestSyncMetadata = require('../models/pullRequestSyncMetadata');
const PullRequest = require('../models/pullRequest');
const PullRequestReview = require('../models/pullRequestReview');
const createGitHubClient = require('../helpers/githubPRHelper');

const connectToMongo = require('../startup/db');

connectToMongo();

const FRONT_END_REPO = 'HighestGoodNetworkApp';
const BACK_END_REPO = 'HGNRest';

const frontEndClient = createGitHubClient({
  owner: 'OneCommunityGlobal',
  repo: FRONT_END_REPO,
});

const backEndClient = createGitHubClient({
  owner: 'OneCommunityGlobal',
  repo: BACK_END_REPO,
});

async function syncGitHubData() {
  const metadata = await PullRequestSyncMetadata.findOne({ name: 'github_review_sync' });
  const lastSyncTime = metadata?.lastSyncedAt;
  const prUpdatedFrontEnd = [];
  const prUpdatedBackEnd = [];

  if (lastSyncTime == null) {
    prUpdatedFrontEnd.push(...(await frontEndClient.fetchPullRequests()));
    prUpdatedBackEnd.push(...(await backEndClient.fetchPullRequests()));
  } else {
    prUpdatedFrontEnd.push(...(await frontEndClient.fetchRecentUpdatedPR(lastSyncTime)));
    prUpdatedBackEnd.push(...(await backEndClient.fetchRecentUpdatedPR(lastSyncTime)));
  }

  await Promise.all(
    prUpdatedFrontEnd.map(async (pr) => {
      // Sync front end pull request information in the database
      await PullRequest.findOneAndUpdate(
        { prNumber: `FE-${pr.number}` },
        {
          $setOnInsert: {
            prNumber: `FE-${pr.number}`,
            prTitle: pr.title,
            prRepo: FRONT_END_REPO,
          },
        },
        { upsert: true, new: true },
      );
      const prReviews = await frontEndClient.fetchReviews(pr.number);
      await Promise.all(
        prReviews.map(async (review) => {
          // Sync reviews information of that pull request in the database
          await PullRequestReview.findOneAndUpdate(
            { id: review.id },
            {
              $setOnInsert: {
                id: review.id,
                prNumber: `FE-${pr.number}`,
                submitedAt: review.submitedAt,
              },
            },
            { upsert: true, new: true },
          );
        }),
      );
    }),
  );
  await Promise.all(
    prUpdatedBackEnd.map(async (pr) => {
      // Sync front end pull request information in the database
      await PullRequest.findOneAndUpdate(
        { prNumber: `BE-${pr.number}` },
        {
          $setOnInsert: {
            prNumber: `BE-${pr.number}`,
            prTitle: pr.title,
            prRepo: BACK_END_REPO,
          },
        },
        { upsert: true, new: true },
      );
      const prReviews = await backEndClient.fetchReviews(pr.number);
      await Promise.all(
        prReviews.map(async (review) => {
          // Sync reviews information of that pull request in the database
          await PullRequestReview.findOneAndUpdate(
            { id: review.id },
            {
              $setOnInsert: {
                id: review.id,
                prNumber: `BE-${pr.number}`,
                submitedAt: review.submitedAt,
              },
            },
            { upsert: true, new: true },
          );
        }),
      );
    }),
  );

  // Update sync date
  await PullRequestSyncMetadata.findOneAndUpdate(
    { name: 'github_review_sync' },
    {
      $set: {
        name: 'github_review_sync',
        lastSyncedAt: new Date(),
      },
    }, // update
    { new: true },
  );
  console.log('Last Sync Time', lastSyncTime);
  console.log('PR to update: ', prUpdatedFrontEnd.length);
}

(async () => {
  await syncGitHubData();
})();
