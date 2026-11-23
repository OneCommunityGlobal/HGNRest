const axios = require('axios');
const FormData = require('form-data');
const MastodonSchedule = require('../models/mastodonSchedule');
const {
  getMastodonCredentials,
  publishingErrorStatus,
  logPublishingError,
} = require('../utilities/socialMediaCredentials');

//  Upload image to Mastodon with optional alt text and get media ID
async function uploadMedia(base64Image, altText = null, { timeout } = {}) {
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

    const { endpoint, headers: authHeaders } = getMastodonCredentials();
    const uploadUrl = `${endpoint}/api/v1/media`;
    const uploadHeaders = {
      ...authHeaders,
      ...formData.getHeaders(),
    };

    const uploadResponse = await axios.post(uploadUrl, formData, {
      headers: uploadHeaders,
      timeout,
      maxRedirects: 0,
    });
    const mediaId = uploadResponse.data.id;

    console.log('Image uploaded, media ID:', mediaId);

    // Step 2: Update the media with alt text if provided
    if (altText && altText.trim()) {
      console.log('Updating media with alt text...');
      const updateUrl = `${endpoint}/api/v1/media/${mediaId}`;
      const updateHeaders = {
        ...authHeaders,
        'Content-Type': 'application/json',
      };

      await axios.put(
        updateUrl,
        {
          description: altText.trim(),
        },
        { headers: updateHeaders, timeout, maxRedirects: 0 },
      );

      console.log('Alt text updated successfully');
    }

    return mediaId;
  } catch (err) {
    logPublishingError('Mastodon media upload failed:', err);
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
      logPublishingError('Mastodon image upload failed; posting without image:', err);
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
  const { endpoint, headers } = getMastodonCredentials();
  const url = `${endpoint}/api/v1/statuses`;

  // Remove local_media fields and mediaAltText before sending to Mastodon
  const mastodonPostData = { ...postData };
  delete mastodonPostData.local_media_base64;
  delete mastodonPostData.local_media_url;
  delete mastodonPostData.mediaAltText;

  return axios.post(url, mastodonPostData, { headers, responseType: 'json', maxRedirects: 0 });
}

//  Express controller: immediate post
async function createStatus(req, res) {
  try {
    const postData = await buildPostData(req.body);
    const response = await postImmediately(postData);
    res.status(200).json({ id: response.data.id, url: response.data.url });
  } catch (err) {
    logPublishingError('Mastodon post failed:', err);
    res.status(publishingErrorStatus(err)).json({ error: 'Failed to create Mastodon status' });
  }
}

//  Schedule a post
async function scheduleStatus(req, res) {
  try {
    // Don't upload the image yet for scheduled posts
    // Just store the base64 data and alt text
    const text = req.body.description || req.body.title;
    if (!text?.trim()) {
      return res.status(400).json({ error: "Post content can't be empty" });
    }

    const scheduledTime = new Date(req.body.scheduledTime);
    if (!req.body.scheduledTime || Number.isNaN(scheduledTime.getTime())) {
      return res.status(400).json({ error: 'A valid scheduled date and time is required' });
    }
    if (scheduledTime <= new Date()) {
      return res.status(400).json({ error: 'Scheduled time must be in the future' });
    }

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

    await MastodonSchedule.create({
      postData: JSON.stringify(postData),
      scheduledTime,
    });
    return res.sendStatus(200);
  } catch (err) {
    logPublishingError('Mastodon schedule failed:', err);
    return res.status(500).json({ error: 'Failed to schedule Mastodon post' });
  }
}

//  Fetch scheduled posts
async function fetchScheduledStatus(_req, res) {
  try {
    // Posted records are kept as delivery history, not shown as scheduled
    const scheduled = await MastodonSchedule.find({ status: { $ne: 'posted' } });
    // Older records may contain raw provider error text; never return it to clients.
    res.json(
      scheduled.map((record) => {
        const post = typeof record.toObject === 'function' ? record.toObject() : { ...record };
        if (post.lastError)
          post.lastError =
            'Mastodon delivery failed; check publishing configuration and provider status';
        return post;
      }),
    );
  } catch (err) {
    res.status(500).send('Failed to fetch scheduled pins');
  }
}

//  Delete scheduled post
async function deleteScheduledStatus(req, res) {
  try {
    // A post being published or already posted cannot be deleted
    const result = await MastodonSchedule.deleteOne({
      _id: req.params.id,
      status: { $in: ['pending', null, 'failed'] },
    });
    if (!result?.deletedCount) {
      return res.status(404).send('Scheduled post not found or already being published');
    }
    return res.send('Scheduled post deleted successfully');
  } catch {
    return res.status(500).send('Failed to delete scheduled post');
  }
}

//  Fetch post history from Mastodon
async function fetchPostHistory(req, res) {
  try {
    const { endpoint, headers } = getMastodonCredentials();

    // Get the account ID first
    const accountUrl = `${endpoint}/api/v1/accounts/verify_credentials`;
    const accountResponse = await axios.get(accountUrl, { headers, maxRedirects: 0 });
    const accountId = accountResponse.data.id;

    // Fetch statuses for this account (limit to last 20 posts)
    const limit = req.query.limit || 20;
    const statusesUrl = `${endpoint}/api/v1/accounts/${accountId}/statuses`;
    const statusesResponse = await axios.get(statusesUrl, {
      headers,
      maxRedirects: 0,
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
    logPublishingError('Failed to fetch Mastodon post history:', err);
    res.status(publishingErrorStatus(err)).json({ error: 'Failed to fetch post history' });
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
