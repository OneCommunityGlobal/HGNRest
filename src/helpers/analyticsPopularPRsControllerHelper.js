const PullRequestSyncMetadata = require('../models/pullRequestSyncMetadata');
const PullRequest = require('../models/pullRequest');
const PullRequestReview = require('../models/pullRequestReview');
const createGitHubClient = require('./githubPRHelper');

function getLastSunday(today = new Date()) {
  const dayOfWeek = today.getUTCDay();
  today.setUTCDate(today.getUTCDate() - dayOfWeek);
  today.setUTCHours(0, 0, 0, 0);
  return today;
}

function getFirstDayInMonth(duration, today = new Date()) {
  today.setUTCMonth(today.getUTCMonth() - duration);
  today.setUTCDate(1);
  today.setUTCHours(0, 0, 0, 0);
  return today;
}

function parseDurationValue(duration) {
  let startDate = null;
  let endDate = null;
  switch (duration) {
    case 'lastWeek': {
      const lastSunday = getLastSunday();
      startDate = new Date(lastSunday);
      endDate = new Date(lastSunday);
      startDate.setUTCDate(startDate.getUTCDate() - 7);
      break;
    }
    case 'last2weeks': {
      const lastSunday = getLastSunday();
      startDate = new Date(lastSunday);
      endDate = new Date(lastSunday);
      startDate.setUTCDate(startDate.getUTCDate() - 14);
      break;
    }
    case 'lastMonth': {
      startDate = getFirstDayInMonth(1);
      endDate = getFirstDayInMonth(0);
      break;
    }
    default: {
      startDate = new Date('1970-01-01T00:00:00Z');
      endDate = new Date();
      break;
    }
  }

  return [startDate, endDate];
}

async function getTodaySyncJob() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0); // midnight UTC

  const todayJob = await PullRequestSyncMetadata.findOne({ jobDate: today });
  return todayJob;
}

async function acquireTodayJob() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0); // midnight UTC

  try {
    // Try to insert a new pending job for today
    const newJob = await PullRequestSyncMetadata.findOneAndUpdate(
      { jobDate: today }, // match today's date
      {
        $setOnInsert: {
          jobDate: today,
          lastSyncedAt: new Date(),
          status: 'PENDING',
          notes: '',
        },
      },
      {
        upsert: true,
        new: true,
        rawResult: true, // so we know if it was inserted vs found
      },
    );

    if (newJob.lastErrorObject.updatedExisting) {
      // A job already existed for today -> return null
      return null;
    }

    // Successfully created new job for today
    return newJob.value;
  } catch (err) {
    // In case of race condition (two servers insert at the same time)
    if (err.code === 11000) {
      // Duplicate key error from unique index → another server won
      return null;
    }
    // Skip update if there is error
    console.log(err);
    return null;
  }
}

async function syncGitHubData(todayJob) {
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
  // Get the last time that the database is successfully sync
  const lastSyncTime = await PullRequestSyncMetadata.findOne({ status: 'SUCCESS' }).sort({
    lastSyncedAt: -1,
  });

  const prUpdatedFrontEnd = [];
  const prUpdatedBackEnd = [];
  let error = '';

  // Fetch updated data from Github
  try {
    if (lastSyncTime == null) {
      prUpdatedFrontEnd.push(...(await frontEndClient.fetchPullRequests()));
      prUpdatedBackEnd.push(...(await backEndClient.fetchPullRequests()));
    } else {
      prUpdatedFrontEnd.push(
        ...(await frontEndClient.fetchRecentUpdatedPR(lastSyncTime.lastSyncedAt.toISOString())),
      );
      prUpdatedBackEnd.push(
        ...(await backEndClient.fetchRecentUpdatedPR(lastSyncTime.lastSyncedAt.toISOString())),
      );
    }
  } catch (err) {
    error += `Failed to get updated PR data from Github. Error: ${err}\n`;
  }

  // Sync front end PRs and reviews
  await Promise.all(
    prUpdatedFrontEnd.map(async (pr) => {
      // Sync front end pull request information in the database
      try {
        const updatedPR = await PullRequest.findOneAndUpdate(
          { prNumber: `FE-${pr.number}` },
          {
            $setOnInsert: {
              prNumber: `FE-${pr.number}`,
              prRepo: FRONT_END_REPO,
              prCreatedAt: pr.created_at,
            },
            $set: {
              prTitle: pr.title, // Always update the title for change
            },
          },
          { upsert: true, new: true },
        );
        if (updatedPR) {
          const prReviews = await frontEndClient.fetchReviews(pr.number);
          await Promise.all(
            prReviews.map(async (review) => {
              // Sync reviews information of that pull request in the database
              const updatedFEReview = await PullRequestReview.findOneAndUpdate(
                { id: review.id },
                {
                  $setOnInsert: {
                    id: review.id,
                    prNumber: `FE-${pr.number}`,
                    submittedAt: review.submitted_at,
                    state: review.state,
                    userId: review.user.id,
                  },
                },
                { upsert: true, new: true },
              );
              if (!updatedFEReview) {
                error += `Failed to save review ${review.id} of PR FE-${pr.number} to the database`;
              }
            }),
          );
        } else {
          error += `Failed to update PR ${pr.number} to the database. Skip updating reviews.\n`;
        }
      } catch (err) {
        error += `Failed to update PR ${pr.number} and the reviews to the database. Error: ${err}.\n`;
      }
    }),
  );

  // Sync back end PRs and reviews
  await Promise.all(
    prUpdatedBackEnd.map(async (pr) => {
      // Sync front end pull request information in the database
      try {
        const updatedBE = await PullRequest.findOneAndUpdate(
          { prNumber: `BE-${pr.number}` },
          {
            $setOnInsert: {
              prNumber: `BE-${pr.number}`,
              prRepo: BACK_END_REPO,
              prCreatedAt: pr.created_at,
            },
            $set: {
              prTitle: pr.title, // Always update the title for change
            },
          },
          { upsert: true, new: true },
        );
        if (updatedBE) {
          const prReviews = await backEndClient.fetchReviews(pr.number);
          await Promise.all(
            prReviews.map(async (review) => {
              // Sync reviews information of that pull request in the database
              const updatedBEReview = await PullRequestReview.findOneAndUpdate(
                { id: review.id },
                {
                  $setOnInsert: {
                    id: review.id,
                    prNumber: `BE-${pr.number}`,
                    submittedAt: review.submitted_at,
                    state: review.state,
                    userId: review.user.id,
                  },
                },
                { upsert: true, new: true },
              );
              if (!updatedBEReview) {
                error += `Failed to save review ${review.id} of PR BE-${pr.number} to the database`;
              }
            }),
          );
        } else {
          error += `Failed to update PR ${pr.number} to the database. Skip updating reviews.\n`;
        }
      } catch (err) {
        error += `Failed to update PR ${pr.number} and the reviews to the database. Error: ${err}.\n`;
      }
    }),
  );

  // Update sync date
  let status = 'SUCCESS';
  if (error !== '') {
    status = 'ERROR';
  }
  todayJob.status = status;
  todayJob.notes = error;
  await todayJob.save();
  // await PullRequestSyncMetadata.create({
  //   lastSyncedAt: new Date(),
  //   status,
  //   notes: error,
  // });
}

module.exports = {
  parseDurationValue,
  getLastSunday,
  getFirstDayInMonth,
  syncGitHubData,
  acquireTodayJob,
  getTodaySyncJob,
};
