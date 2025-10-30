const axios = require('axios');
const MastodonSchedule = require('../models/mastodonSchedule');

const MASTODON_ENDPOINT = process.env.MASTODON_ENDPOINT || 'https://mastodon.social';
const ACCESS_TOKEN = process.env.MASTODON_ACCESS_TOKEN;

//  Simple: get bearer headers or throw if missing
function getAuthHeaders() {
  if (!ACCESS_TOKEN) throw new Error('MASTODON_ACCESS_TOKEN not set');
  return { Authorization: `Bearer ${ACCESS_TOKEN}` };
}

//  Build post body (with optional image handling)
function buildPostData({ title, description, imgType, mediaItems }) {
  const text = description || title;
  if (!text?.trim()) throw new Error("Post content can't be empty");

  const postData = {
    status: text.trim(),
    visibility: 'public',
  };

  // Optionally attach image URLs or base64 (future upload support)
  if (imgType === 'URL' && mediaItems) {
    // For now, we can pass the URL in our own key (not Mastodon official)
    // Later we can convert this to a real Mastodon media upload.
    postData.local_media_url = mediaItems;
  } else if (imgType === 'FILE' && mediaItems?.startsWith('data:')) {
    postData.local_media_base64 = mediaItems;
  }

  return postData;
}

//  Post immediately to Mastodon
async function postImmediately(postData) {
  const url = `${MASTODON_ENDPOINT}/api/v1/statuses`;
  const headers = getAuthHeaders();
  return axios.post(url, postData, { headers, responseType: 'json' });
}

//  Express controller: immediate post
async function createStatus(req, res) {
  try {
    const postData = buildPostData(req.body);
    const response = await postImmediately(postData);
    res.status(200).json(response.data);
  } catch (err) {
    console.error('Mastodon post failed:', err.response?.data || err.message);
    const status = err.response?.status || 500;
    const msg = err.response?.data?.message || err.message || 'Failed to create Mastodon status';
    res.status(status).json({ error: msg });
  }
}

//  Schedule a post
async function scheduleStatus(req, res) {
  try {
    const postData = JSON.stringify(buildPostData(req.body));
    const { scheduledTime } = req.body;
    await MastodonSchedule.create({ postData, scheduledTime });
    res.sendStatus(200);
  } catch (err) {
    console.error('Schedule failed:', err.message);
    res.sendStatus(500);
  }
}

//  Fetch scheduled posts
async function fetchScheduledStatus(_req, res) {
  try {
    const scheduled = await MastodonSchedule.find();
    res.json(scheduled);
  } catch (err) {
    res.status(500).send('Failed to fetch scheduled pins');
  }
}

//  Delete scheduled post
async function deleteScheduledStatus(req, res) {
  try {
    await MastodonSchedule.deleteOne({ _id: req.params.id });
    res.send('Scheduled post deleted successfully');
  } catch {
    res.status(500).send('Failed to delete scheduled post');
  }
}

module.exports = {
  createPin: createStatus,
  schedulePin: scheduleStatus,
  fetchScheduledPin: fetchScheduledStatus,
  deletedScheduledPin: deleteScheduledStatus,
  postImmediately,
};
