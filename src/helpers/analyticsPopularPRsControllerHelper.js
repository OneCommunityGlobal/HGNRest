const PullRequestSyncMetadata = require('../models/pullRequestSyncMetadata');
const PullRequest = require('../models/pullRequest');
const PullRequestReview = require('../models/pullRequestReview');
const createGitHubClient = require('./githubPRHelper');
const { RateLimitedError } = require('../utilities/errorHandling/customError');

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

function getJobId() {
  let pacificId = new Date().toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' }); // Get date in pacific time
  const pacificHour = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false, // 24-hour format
    timeZone: 'America/Los_Angeles',
  }).format(new Date());

  if (pacificHour >= 4) {
    pacificId += '-4';
  } else if (pacificHour >= 2) {
    pacificId += '-2';
  } else {
    pacificId += '-0';
  }

  return pacificId;
}

async function isStaleData() {
  const lastSuccessfulSync = await PullRequestSyncMetadata.findOne({ status: 'SUCCESS' }).sort({
    lastSyncedAt: -1,
  });
  const today = new Date();
  // Difference in milliseconds
  const diffMs = today - lastSuccessfulSync.lastSyncedAt;

  // Convert to days
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // If more than 7 days and there are no successful sync, return error
  if (diffDays >= 7) {
    return true;
  }
  return false;
}

function alreadyDone(lastSync) {
  if (lastSync === null) {
    return false;
  }
  const today = new Date().toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' });
  const lastSyncDate = lastSync.jobId;
  if (lastSync.status === 'SUCCESS' && lastSyncDate.slice(0, -2) === today) {
    return true;
  }
  return false;
}

async function acquireTodayJob() {
  // Turn date and hour in Pacific time to jobId, If isInstantJob, the hour will not be included
  const currentJobId = getJobId();
  try {
    // Try to insert a new pending job for today
    const newJob = await PullRequestSyncMetadata.findOneAndUpdate(
      { jobId: currentJobId }, // match today's date
      {
        $setOnInsert: {
          jobId: currentJobId,
          lastSyncedAt: new Date(),
          status: 'PENDING',
          notes: '',
          remainingFrontEndPRs: [],
          remainingBackEndPRs: [],
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
    console.log(err);
    // In case of race condition (two servers insert at the same time)
    if (err.code === 11000) {
      // Duplicate key error from unique index -> another server won
      return null;
    }
    // Skip update if there is error
    return null;
  }
}

/**
 * Function to get a list of PRs from Github that need to be updated since the last time sync
 * Update the list prUpdatedFrontEnd and prUpdatedBackend in the parameter
 * Return error string
 */
async function getPRsToUpdate(
  todayJob,
  lastSync,
  frontEndClient,
  backEndClient,
  prUpdatedFrontEnd,
  prUpdatedBackEnd,
) {
  let error = '';

  // If this is not the first time of the day, and last time sync is not success, then attempt to resume from what's left last time
  if (lastSync !== null && todayJob !== null) {
    const jobDate = todayJob.jobId;
    if (jobDate.slice(-2) !== '-0' && lastSync.status !== 'SUCCESS') {
      if (lastSync.remainingFrontEndPRs.length !== 0 || lastSync.remainingBackEndPRs.length !== 0) {
        // Resume from previous job
        prUpdatedFrontEnd.push(...lastSync.remainingFrontEndPRs);
        prUpdatedBackEnd.push(...lastSync.remainingBackEndPRs);
        return '';
      }
    }
  }

  // If there are no pr to resume from, get new updated pr since the last time successfully sync
  // Get the last time that the database is successfully sync
  const lastSuccessfulSync = await PullRequestSyncMetadata.findOne({ status: 'SUCCESS' }).sort({
    lastSyncedAt: -1,
  });
  // Fetch updated data from Github
  try {
    if (lastSuccessfulSync == null) {
      prUpdatedFrontEnd.push(...(await frontEndClient.fetchPullRequests()));
      prUpdatedBackEnd.push(...(await backEndClient.fetchPullRequests()));
    } else {
      prUpdatedFrontEnd.push(
        ...(await frontEndClient.fetchRecentUpdatedPR(
          lastSuccessfulSync.lastSyncedAt.toISOString(),
        )),
      );
      prUpdatedBackEnd.push(
        ...(await backEndClient.fetchRecentUpdatedPR(
          lastSuccessfulSync.lastSyncedAt.toISOString(),
        )),
      );
    }
  } catch (err) {
    // If we got RateLimited, throw the error to stop updating
    if (err instanceof RateLimitedError) {
      throw err;
    } else {
      // For other errors, we can document them
      error += `Failed to get updated PR data from Github. Error: ${err}\n`;
    }
  }

  return error;
}

/**
 * Sync all the new data from prList to local database and sync all the reviews of that prList
 * @param prefix - Prefix that is added in front of prNumber to know if the pr is from the backend or frontend, has 2 values FE and BE
 * @param repo - The repo that prList belong to
 * @param prList - List of PRs that need to sync update to local database
 * @param client - Github client that is used to make api call with github
 * @returns error string and a list of remaining PRs that fails to sync
 */
async function updateGitHubRepo(prefix, repo, prList, client) {
  const updatedPRList = [];
  const error = [];
  const remaining = [];

  // Update all PRs data to local db
  await Promise.all(
    prList.map(async (pr) => {
      // Sync pull request information to the local database
      try {
        const updatedPR = await PullRequest.findOneAndUpdate(
          { prNumber: `${prefix}-${pr.number}` },
          {
            $setOnInsert: {
              prNumber: `${prefix}-${pr.number}`,
              prRepo: repo,
              prCreatedAt: pr.created_at,
            },
            $set: {
              prTitle: pr.title, // Always update the title for change
            },
          },
          { upsert: true, new: true },
        );
        if (updatedPR) {
          updatedPRList.push(pr);
        } else {
          remaining.push({
            number: pr.number,
            created_at: pr.created_at,
            title: pr.title,
          });
        }
      } catch (err) {
        error.push(
          `Failed to update PR ${pr.number} and the reviews to the database. Error: ${err}.\n`,
        );
      }
    }),
  );

  // Update PR reviews of successfully updated PRs
  // eslint-disable-next-line no-restricted-syntax
  for (let i = 0; i < updatedPRList.length; i += 1) {
    const pr = updatedPRList[i];
    let prReviews;
    try {
      prReviews = await client.fetchReviews(pr.number);
    } catch (err) {
      if (err instanceof RateLimitedError) {
        remaining.push(
          ...updatedPRList.slice(i).map((prItem) => ({
            number: prItem.number,
            created_at: prItem.created_at,
            title: prItem.title,
          })),
        );
        error.push(`Failed to get reviews from PR ${pr.number} in repo ${repo}. Rate limited\n`);
        const errorStr = error.join(' ');
        // Stop immediately after getting rate-limited
        return { errorStr, remaining };
      }

      error.push(
        `Failed to get reviews from PR ${pr.number} in repo ${repo} from Github. Skip updating reviews. Error ${err}\n`,
      );
      remaining.push({
        number: pr.number,
        created_at: pr.created_at,
        title: pr.title,
      });
      continue;
    }

    try {
      // eslint-disable-next-line no-await-in-loop
      await Promise.all(
        prReviews.map(async (review) => {
          // Sync reviews information of that pull request in the database
          const updatedReview = await PullRequestReview.findOneAndUpdate(
            { id: review.id },
            {
              $setOnInsert: {
                id: review.id,
                prNumber: `${prefix}-${pr.number}`,
                submittedAt: review.submitted_at,
                state: review.state,
                userId: review.user.id,
              },
            },
            { upsert: true, new: true },
          );
          if (!updatedReview) {
            error.push(
              `Failed to save review ${review.id} of PR ${prefix}-${pr.number} to the database\n`,
            );
          }
        }),
      );
    } catch (err) {
      error.push(
        `Failed to update PR ${pr.number} and the reviews to the database. Error: ${err}.\n`,
      );
      remaining.push({
        number: pr.number,
        created_at: pr.created_at,
        title: pr.title,
      });
    }
  }

  const errorStr = error.join(' ');
  return { errorStr, remaining };
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

  const prUpdatedFrontEnd = [];
  const prUpdatedBackEnd = [];
  let error = '';

  try {
    // Get the second latest record as the lastSync, as this one is the latest syncing
    const lastSync = await PullRequestSyncMetadata.findOne().sort({ lastSyncedAt: -1 }).skip(1);

    // Skip if the job for today has already been done and success
    if (alreadyDone(lastSync)) {
      todayJob.status = 'SUCCESS';
      await todayJob.save();
      return;
    }

    // Fetch updated data from Github
    error = await getPRsToUpdate(
      todayJob,
      lastSync,
      frontEndClient,
      backEndClient,
      prUpdatedFrontEnd,
      prUpdatedBackEnd,
    );
  } catch (err) {
    if (err instanceof RateLimitedError) {
      todayJob.notes = 'Rate limited, cannot get the list of PRs from Frontend and backend repo';
    } else {
      todayJob.notes = `Failed to get updated PR data from Github. Error: ${err}\n`;
    }
    todayJob.status = 'ERROR';
    todayJob.remainingFrontEndPRs = [];
    todayJob.remainingBackEndPRs = [];
    await todayJob.save();
    return;
  }

  try {
    // Sync frontend and backend PRs
    const [
      { errorStr: error2, remaining: remainingFE },
      { errorStr: error3, remaining: remainingBE },
    ] = await Promise.all([
      updateGitHubRepo('FE', FRONT_END_REPO, prUpdatedFrontEnd, frontEndClient),
      updateGitHubRepo('BE', BACK_END_REPO, prUpdatedBackEnd, backEndClient),
    ]);

    error = error2 + error3;

    // Update sync date
    let status = 'SUCCESS';
    if (error !== '') {
      status = 'ERROR';
    }
    todayJob.status = status;
    todayJob.notes = error;
    todayJob.remainingFrontEndPRs = remainingFE;
    todayJob.remainingBackEndPRs = remainingBE;
    await todayJob.save();
  } catch (err) {
    todayJob.status = 'ERROR';
    todayJob.notes = `Failed to sync reviews from Github. Error: ${err}\n`;
    todayJob.remainingFrontEndPRs = [];
    todayJob.remainingBackEndPRs = [];
    await todayJob.save();
  }
}

module.exports = {
  parseDurationValue,
  getLastSunday,
  getFirstDayInMonth,
  syncGitHubData,
  acquireTodayJob,
  isStaleData,
};
