const cron = require('node-cron');
const axios = require('axios');
const MastodonSchedule = require('../models/mastodonSchedule');
const { uploadMedia } = require('../controllers/mastodonPostController');

const MASTODON_ENDPOINT = process.env.MASTODON_ENDPOINT || 'https://mastodon.social';
const ACCESS_TOKEN = process.env.MASTODON_ACCESS_TOKEN;

function getAuthHeaders() {
  if (!ACCESS_TOKEN) throw new Error('MASTODON_ACCESS_TOKEN not set');
  return { Authorization: `Bearer ${ACCESS_TOKEN}` };
}

async function postToMastodon(postData) {
  const url = `${MASTODON_ENDPOINT}/api/v1/statuses`;
  const headers = getAuthHeaders();

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

  return axios.post(url, mastodonData, { headers, responseType: 'json' });
}

async function processScheduledPosts() {
  try {
    const now = new Date();
    const scheduled = await MastodonSchedule.find({
      scheduledTime: { $lte: now },
    });

    if (scheduled.length > 0) {
      console.log(`Found ${scheduled.length} scheduled posts to process`);
    }

    // Use Promise.all with map instead of for-of loop
    await Promise.all(
      scheduled.map(async (post) => {
        try {
          console.log(`Processing scheduled post ${post._id}`);
          await postToMastodon(post.postData);
          await MastodonSchedule.deleteOne({ _id: post._id });
          console.log(`✅ Posted scheduled Mastodon post: ${post._id}`);
        } catch (err) {
          console.error(`❌ Failed to post scheduled Mastodon post ${post._id}:`, err.message);
          if (err.response?.data) {
            console.error('Mastodon API error:', err.response.data);
          }
        }
      }),
    );
  } catch (err) {
    console.error('Error processing scheduled Mastodon posts:', err.message);
  }
}

// Run every minute
function startMastodonScheduleJob() {
  cron.schedule('* * * * *', processScheduledPosts);
  console.log('✅ Mastodon schedule cron job started (runs every minute)');
}

module.exports = { startMastodonScheduleJob, processScheduledPosts };
