const axios = require('axios');
const FormData = require('form-data');
const MastodonSchedule = require('../models/mastodonSchedule');

const MASTODON_ENDPOINT = process.env.MASTODON_ENDPOINT || 'https://mastodon.social';
const ACCESS_TOKEN = process.env.MASTODON_ACCESS_TOKEN;

//  Simple: get bearer headers or throw if missing
function getAuthHeaders() {
  if (!ACCESS_TOKEN) throw new Error('MASTODON_ACCESS_TOKEN not set');
  return { Authorization: `Bearer ${ACCESS_TOKEN}` };
}

//  Upload image to Mastodon with optional alt text and get media ID
async function uploadMedia(base64Image, altText = null) {
  try {
    // Convert base64 to buffer
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Step 1: Upload the media file
    const formData = new FormData();
    formData.append('file', buffer, {
      filename: 'upload.png',
      contentType: 'image/png',
    });

    const uploadUrl = `${MASTODON_ENDPOINT}/api/v1/media`;
    const uploadHeaders = {
      ...getAuthHeaders(),
      ...formData.getHeaders(),
    };

    const uploadResponse = await axios.post(uploadUrl, formData, { headers: uploadHeaders });
    const mediaId = uploadResponse.data.id;

    console.log('Image uploaded, media ID:', mediaId);

    // Step 2: Update the media with alt text if provided
    if (altText && altText.trim()) {
      console.log('Updating media with alt text...');
      const updateUrl = `${MASTODON_ENDPOINT}/api/v1/media/${mediaId}`;
      const updateHeaders = {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      };

      await axios.put(
        updateUrl,
        {
          description: altText.trim(),
        },
        { headers: updateHeaders },
      );

      console.log('Alt text updated successfully');
    }

    return mediaId;
  } catch (err) {
    console.error('Media upload failed:', err.response?.data || err.message);
    throw new Error('Failed to upload image to Mastodon');
  }
}

//  Build post body (with optional image handling)
async function buildPostData({ title, description, imgType, mediaItems, mediaAltText }) {
  const text = description || title;
  if (!text?.trim()) throw new Error("Post content can't be empty");

  const postData = {
    status: text.trim(),
    visibility: 'public',
  };

  // Handle image upload
  if (imgType === 'FILE' && mediaItems?.startsWith('data:')) {
    try {
      const mediaId = await uploadMedia(mediaItems, mediaAltText);
      // eslint-disable-next-line camelcase
      postData.media_ids = [mediaId];
      // Store base64 and alt text for scheduled posts
      // eslint-disable-next-line camelcase
      postData.local_media_base64 = mediaItems;
      if (mediaAltText) {
        postData.mediaAltText = mediaAltText;
      }
    } catch (err) {
      console.error('Image upload failed, posting without image:', err.message);
      // Continue without image rather than failing the entire post
    }
  } else if (imgType === 'URL' && mediaItems) {
    // For URL type, store for future use
    // eslint-disable-next-line camelcase
    postData.local_media_url = mediaItems;
  }

  return postData;
}

//  Post immediately to Mastodon
async function postImmediately(postData) {
  const url = `${MASTODON_ENDPOINT}/api/v1/statuses`;
  const headers = getAuthHeaders();

  // Remove local_media fields and mediaAltText before sending to Mastodon
  // eslint-disable-next-line camelcase
  const { local_media_base64, local_media_url, mediaAltText, ...mastodonPostData } = postData;

  return axios.post(url, mastodonPostData, { headers, responseType: 'json' });
}

//  Express controller: immediate post
async function createStatus(req, res) {
  try {
    const postData = await buildPostData(req.body);
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
    // Don't upload the image yet for scheduled posts
    // Just store the base64 data and alt text
    const text = req.body.description || req.body.title;
    if (!text?.trim()) throw new Error("Post content can't be empty");

    const postData = {
      status: text.trim(),
      visibility: 'public',
    };

    // Store image data and alt text for later upload
    if (req.body.imgType === 'FILE' && req.body.mediaItems) {
      // eslint-disable-next-line camelcase
      postData.local_media_base64 = req.body.mediaItems;
      if (req.body.mediaAltText) {
        postData.mediaAltText = req.body.mediaAltText;
      }
    } else if (req.body.imgType === 'URL' && req.body.mediaItems) {
      // eslint-disable-next-line camelcase
      postData.local_media_url = req.body.mediaItems;
    }

    const { scheduledTime } = req.body;
    await MastodonSchedule.create({
      postData: JSON.stringify(postData),
      scheduledTime,
    });
    res.sendStatus(200);
  } catch (err) {
    console.error('Schedule failed:', err.message);
    res.status(500).json({ error: err.message });
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

//  Fetch post history from Mastodon
async function fetchPostHistory(req, res) {
  try {
    const headers = getAuthHeaders();

    // Get the account ID first
    const accountUrl = `${MASTODON_ENDPOINT}/api/v1/accounts/verify_credentials`;
    const accountResponse = await axios.get(accountUrl, { headers });
    const accountId = accountResponse.data.id;

    // Fetch statuses for this account (limit to last 20 posts)
    const limit = req.query.limit || 20;
    const statusesUrl = `${MASTODON_ENDPOINT}/api/v1/accounts/${accountId}/statuses`;
    const statusesResponse = await axios.get(statusesUrl, {
      headers,
      params: {
        limit,
        exclude_replies: true,
        exclude_reblogs: true,
      },
    });

    // Format the response
    const posts = statusesResponse.data.map((status) => ({
      id: status.id,
      content: status.content,
      // eslint-disable-next-line camelcase
      created_at: status.created_at,
      url: status.url,
      // eslint-disable-next-line camelcase
      media_attachments: status.media_attachments || [],
      // eslint-disable-next-line camelcase
      favourites_count: status.favourites_count || 0,
      // eslint-disable-next-line camelcase
      reblogs_count: status.reblogs_count || 0,
    }));

    res.json(posts);
  } catch (err) {
    console.error('Failed to fetch post history:', err.response?.data || err.message);
    const status = err.response?.status || 500;
    const msg = err.response?.data?.error || err.message || 'Failed to fetch post history';
    res.status(status).json({ error: msg });
  }
}

module.exports = {
  createPin: createStatus,
  schedulePin: scheduleStatus,
  fetchScheduledPin: fetchScheduledStatus,
  deletedScheduledPin: deleteScheduledStatus,
  fetchPostHistory,
  postImmediately,
  uploadMedia,
};
