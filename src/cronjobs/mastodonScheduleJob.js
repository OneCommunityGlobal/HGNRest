const crypto = require('crypto');
const os = require('os');
const cron = require('node-cron');
const axios = require('axios');
const MastodonSchedule = require('../models/mastodonSchedule');
const { uploadMedia } = require('../controllers/mastodonPostController');

const MASTODON_ENDPOINT = process.env.MASTODON_ENDPOINT || 'https://mastodon.social';
const ACCESS_TOKEN = process.env.MASTODON_ACCESS_TOKEN;

// How long a worker owns a claimed post. Must be longer than one publish
// attempt (media upload plus the status request).
const LEASE_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 30 * 1000;
const MAX_ATTEMPTS = 3;
const MAX_POSTS_PER_RUN = 20;

// Records saved before delivery state existed have no status field
const PENDING = { $in: ['pending', null] };
const CLEAR_LOCK = { lockOwner: '', lockedUntil: '' };

const WORKER_ID = `${os.hostname()}:${process.pid}:${crypto.randomUUID()}`;

function getAuthHeaders() {
  if (!ACCESS_TOKEN) throw new Error('MASTODON_ACCESS_TOKEN not set');
  return { Authorization: `Bearer ${ACCESS_TOKEN}` };
}

// Same key for every attempt at the same scheduled post, so Mastodon
// drops a repeat it has already accepted (it keeps keys for one hour)
function getIdempotencyKey(postId) {
  return `hgn-mastodon-schedule-${postId}`;
}

async function postToMastodon(postData, idempotencyKey) {
  const url = `${MASTODON_ENDPOINT}/api/v1/statuses`;
  const headers = { ...getAuthHeaders(), 'Idempotency-Key': idempotencyKey };

  // Parse if string
  const data = typeof postData === 'string' ? JSON.parse(postData) : postData;

  // Create the actual post data for Mastodon
  const mastodonData = {
    status: data.status,
    visibility: data.visibility || 'public',
  };

  // Handle image upload if present
  // eslint-disable-next-line camelcase
  if (data.local_media_base64) {
    try {
      console.log('Uploading image from scheduled post...');
      // eslint-disable-next-line camelcase
      const altText = data.mediaAltText || null;
      // eslint-disable-next-line camelcase
      const mediaId = await uploadMedia(data.local_media_base64, altText);
      console.log('Image uploaded, media ID:', mediaId);
      // eslint-disable-next-line camelcase
      mastodonData.media_ids = [mediaId];
    } catch (err) {
      console.error('Image upload failed in cron job:', err.message);
      // Continue without image
    }
  }

  console.log('Posting to Mastodon:', `${mastodonData.status.substring(0, 50)}...`);

  return axios.post(url, mastodonData, {
    headers,
    responseType: 'json',
    timeout: REQUEST_TIMEOUT_MS,
  });
}

// A post still "publishing" after its lease may already be live on
// Mastodon, so it is marked failed instead of being sent again
async function failExpiredClaims(now) {
  const result = await MastodonSchedule.updateMany(
    { status: 'publishing', lockedUntil: { $lt: now } },
    {
      $set: {
        status: 'failed',
        lastError: 'Delivery was not confirmed before the claim expired; not retried',
      },
      $unset: CLEAR_LOCK,
    },
  );
  if (result?.nModified || result?.modifiedCount) {
    console.error('Marked unconfirmed scheduled Mastodon posts as failed:', result);
  }
}

// Atomically move one due post from pending to publishing. Only one
// callback or server instance can win a given post.
// Posts already tried in this run are skipped, so a retry waits for the
// next run instead of repeating straight away.
function claimNextDuePost(workerId, dueBefore, triedIds) {
  return MastodonSchedule.findOneAndUpdate(
    { _id: { $nin: triedIds }, status: PENDING, scheduledTime: { $lte: dueBefore } },
    {
      $set: {
        status: 'publishing',
        lockOwner: workerId,
        lockedUntil: new Date(Date.now() + LEASE_MS),
      },
      $inc: { attempts: 1 },
    },
    { new: true, sort: { scheduledTime: 1 } },
  );
}

// Only a clear rejection from Mastodon is retried. A timeout or lost
// connection may mean the post went through, so it is not retried.
function isRetryable(err) {
  const status = err.response?.status;
  return status === 429 || status >= 500;
}

async function releaseFailedClaim(post, workerId, err) {
  const retry = isRetryable(err) && (post.attempts || 0) < MAX_ATTEMPTS;
  const message = err.response?.data?.error || err.message;
  console.error(`❌ Failed to post scheduled Mastodon post ${post._id}:`, message);

  try {
    await MastodonSchedule.updateOne(
      { _id: post._id, status: 'publishing', lockOwner: workerId },
      { $set: { status: retry ? 'pending' : 'failed', lastError: message }, $unset: CLEAR_LOCK },
    );
  } catch (updateErr) {
    // The claim stays in place and expires to failed, so nothing is resent
    console.error(`Could not release scheduled Mastodon post ${post._id}:`, updateErr.message);
  }
}

async function recordDelivery(post, workerId, response) {
  const delivered = { status: 'posted', postedAt: new Date() };
  if (response?.data?.id) delivered.remoteStatusId = String(response.data.id);

  try {
    await MastodonSchedule.updateOne(
      { _id: post._id, status: 'publishing', lockOwner: workerId },
      { $set: delivered, $unset: { ...CLEAR_LOCK, lastError: '' } },
    );
    console.log(`✅ Posted scheduled Mastodon post: ${post._id}`);
  } catch (err) {
    // The claim stays in place and expires to failed, so the post is not
    // published a second time
    console.error(
      `Posted scheduled Mastodon post ${post._id} but could not record it:`,
      err.message,
    );
  }
}

async function publishClaimedPost(post, workerId) {
  console.log(`Processing scheduled post ${post._id}`);
  let response;
  try {
    response = await postToMastodon(post.postData, getIdempotencyKey(post._id));
  } catch (err) {
    await releaseFailedClaim(post, workerId, err);
    return;
  }
  await recordDelivery(post, workerId, response);
}

// node-cron passes the run time as the first argument, so options are
// read defensively
async function processScheduledPosts(options) {
  const workerId = options?.workerId || WORKER_ID;
  const runStartedAt = new Date();
  const triedIds = [];

  try {
    await failExpiredClaims(runStartedAt);
  } catch (err) {
    console.error('Error expiring scheduled Mastodon claims:', err.message);
  }

  // Posts are claimed and sent one at a time
  for (let i = 0; i < MAX_POSTS_PER_RUN; i += 1) {
    let post;
    try {
      // eslint-disable-next-line no-await-in-loop
      post = await claimNextDuePost(workerId, runStartedAt, triedIds);
    } catch (err) {
      console.error('Error claiming scheduled Mastodon posts:', err.message);
      return;
    }
    if (!post) return;
    triedIds.push(post._id);
    // eslint-disable-next-line no-await-in-loop
    await publishClaimedPost(post, workerId);
  }
}

// Run every minute
function startMastodonScheduleJob() {
  cron.schedule('* * * * *', processScheduledPosts);
  console.log('✅ Mastodon schedule cron job started (runs every minute)');
}

module.exports = { startMastodonScheduleJob, processScheduledPosts };
