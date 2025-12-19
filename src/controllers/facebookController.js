const axios = require('axios');
const moment = require('moment-timezone');
const ScheduledFacebookPost = require('../models/scheduledFacebookPost');
const { hasPermission } = require('../utilities/permissions');

const graphBaseUrl = process.env.FACEBOOK_GRAPH_URL || 'https://graph.facebook.com/v19.0';
const defaultPageId = process.env.FACEBOOK_PAGE_ID;
const pageAccessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
const PST_TIMEZONE = 'America/Los_Angeles';

const publishToFacebook = async ({ message, link, imageUrl, pageId }) => {
  if (!pageAccessToken) {
    const error = new Error('FACEBOOK_PAGE_ACCESS_TOKEN is not configured on the server.');
    error.status = 500;
    throw error;
  }

  const targetPageId = pageId || defaultPageId;

  // Debug (non-secret) logging to help diagnose config issues
  console.log(
    '[FacebookPost] targetPageId:',
    targetPageId || '(none)',
    'tokenSet:',
    Boolean(pageAccessToken),
  );

  if (!targetPageId) {
    const error = new Error(
      'No Facebook page id provided. Supply pageId in the request or set FACEBOOK_PAGE_ID.',
    );
    error.status = 400;
    throw error;
  }

  if (!message && !link && !imageUrl) {
    const error = new Error('message, link, or imageUrl is required to create a Facebook post.');
    error.status = 400;
    throw error;
  }

  const isPhotoPost = Boolean(imageUrl);
  const endpoint = `${graphBaseUrl}/${targetPageId}/${isPhotoPost ? 'photos' : 'feed'}`;

  const payload = {
    access_token: pageAccessToken,
  };

  if (message) payload.message = message;
  if (link) payload.link = link;
  if (isPhotoPost) payload.url = imageUrl;

  try {
    console.log('[FacebookPost] endpoint:', endpoint, 'graphBaseUrl:', graphBaseUrl);
    const response = await axios.post(endpoint, payload);
    return {
      postId: response.data.id,
      postType: isPhotoPost ? 'photo' : 'feed',
    };
  } catch (error) {
    const fbError = error.response?.data?.error;
    console.error('[FacebookPost] error response:', fbError || error.message);
    const err = new Error(fbError || error.message);
    err.status = error.response?.status || 500;
    err.details = fbError || error.message;
    throw err;
  }
};

/**
 * Saves a direct post to MongoDB for history tracking.
 * Called after successful publish to Facebook.
 */
const saveDirectPostToHistory = async ({
  message,
  link,
  imageUrl,
  pageId,
  postId,
  postType,
  createdBy,
}) => {
  try {
    const directPost = new ScheduledFacebookPost({
      message,
      link,
      imageUrl,
      pageId,
      scheduledFor: new Date(),
      timezone: PST_TIMEZONE,
      status: 'sent',
      postMethod: 'direct',
      postedAt: new Date(),
      postId,
      postType,
      createdBy,
    });
    await directPost.save();
    console.log('[FacebookPost] Direct post saved to history:', directPost._id);
  } catch (error) {
    // Don't fail the request if history save fails
    console.error('[FacebookPost] Failed to save direct post to history:', error.message);
  }
};

/**
 * Posts content to a Facebook Page using the Graph API.
 * Now also saves to MongoDB for history tracking.
 */
const postToFacebook = async (req, res) => {
  const canPost = await hasPermission(req.body.requestor, 'postFacebookContent');
  const canSendEmails = await hasPermission(req.body.requestor, 'sendEmails');
  if (!canPost && !canSendEmails) {
    res.status(403).send({ error: 'You are not authorized to post to Facebook.' });
    return;
  }

  const { message, link, imageUrl, pageId } = req.body || {};

  try {
    const result = await publishToFacebook({ message, link, imageUrl, pageId });

    // Save to MongoDB for history tracking
    await saveDirectPostToHistory({
      message,
      link,
      imageUrl,
      pageId: pageId || defaultPageId,
      postId: result.postId,
      postType: result.postType,
      createdBy: req.body.requestor
        ? {
            userId: req.body.requestor.requestorId,
            role: req.body.requestor.role,
            permissions: req.body.requestor.permissions,
          }
        : undefined,
    });

    res.status(200).send({
      success: true,
      ...result,
    });
  } catch (error) {
    res.status(error.status || 500).send({
      error: 'Failed to post to Facebook',
      details: error.details || error.message,
    });
  }
};

const scheduleFacebookPost = async (req, res) => {
  const canPost = await hasPermission(req.body.requestor, 'postFacebookContent');
  const canSendEmails = await hasPermission(req.body.requestor, 'sendEmails');
  if (!canPost && !canSendEmails) {
    res.status(403).send({ error: 'You are not authorized to schedule Facebook posts.' });
    return;
  }

  const { message, link, imageUrl, pageId, scheduledFor, timezone } = req.body || {};
  if (!message) {
    res.status(400).send({ error: 'message is required to schedule a Facebook post.' });
    return;
  }

  const targetTimezone = timezone || PST_TIMEZONE;
  if (!moment.tz.zone(targetTimezone)) {
    res.status(400).send({ error: 'Invalid timezone provided.' });
    return;
  }

  if (!pageAccessToken) {
    res.status(500).send({ error: 'FACEBOOK_PAGE_ACCESS_TOKEN is not configured on the server.' });
    return;
  }

  const targetPageId = pageId || defaultPageId;
  if (!targetPageId) {
    res.status(400).send({
      error: 'No Facebook page id provided. Supply pageId in the request or set FACEBOOK_PAGE_ID.',
    });
    return;
  }

  const scheduledMoment = moment.tz(scheduledFor, targetTimezone);

  if (!scheduledMoment.isValid()) {
    res.status(400).send({ error: 'Invalid scheduledFor date/time provided.' });
    return;
  }

  if (!scheduledMoment.isAfter(moment.tz(targetTimezone))) {
    res.status(400).send({ error: 'Scheduled time must be in the future (PST).' });
    return;
  }

  try {
    const scheduledPost = new ScheduledFacebookPost({
      message,
      link,
      imageUrl,
      pageId: targetPageId,
      scheduledFor: scheduledMoment.toDate(),
      timezone: targetTimezone,
      createdBy: req.body.requestor
        ? {
            userId: req.body.requestor.requestorId,
            role: req.body.requestor.role,
            permissions: req.body.requestor.permissions,
          }
        : undefined,
    });

    await scheduledPost.save();
    res.status(201).send({ success: true, scheduledPost });
  } catch (error) {
    console.error('[FacebookPost] schedule error:', error.message);
    res.status(500).send({ error: 'Failed to schedule Facebook post', details: error.message });
  }
};

/**
 * Fetches scheduled posts (pending/sending) for display in the UI.
 * Optionally filters by status and supports pagination.
 */
const getScheduledPosts = async (req, res) => {
  const canPost = await hasPermission(req.body.requestor, 'postFacebookContent');
  const canSendEmails = await hasPermission(req.body.requestor, 'sendEmails');
  if (!canPost && !canSendEmails) {
    res.status(403).send({ error: 'You are not authorized to view scheduled posts.' });
    return;
  }

  const { status, limit = 50, skip = 0 } = req.query;

  try {
    const query = {};
    if (status) {
      query.status = status;
    } else {
      query.status = { $in: ['pending', 'sending'] };
    }

    const scheduledPosts = await ScheduledFacebookPost.find(query)
      .sort({ scheduledFor: 1 })
      .skip(parseInt(skip, 10))
      .limit(parseInt(limit, 10))
      .lean()
      .exec();

    const total = await ScheduledFacebookPost.countDocuments(query);

    res.status(200).send({
      success: true,
      scheduledPosts,
      pagination: { total, limit: parseInt(limit, 10), skip: parseInt(skip, 10) },
    });
  } catch (error) {
    console.error('[FacebookPost] getScheduledPosts error:', error.message);
    res.status(500).send({ error: 'Failed to fetch scheduled posts', details: error.message });
  }
};

/**
 * Fetches post history combining:
 * 1. Sent/failed posts from MongoDB (both direct and scheduled)
 * 2. Posts from Facebook Graph API (all posts on the page)
 *
 * Supports filtering by status (sent/failed) and postMethod (direct/scheduled)
 */
const getPostHistory = async (req, res) => {
  const canPost = await hasPermission(req.body.requestor, 'postFacebookContent');
  const canSendEmails = await hasPermission(req.body.requestor, 'sendEmails');
  if (!canPost && !canSendEmails) {
    res.status(403).send({ error: 'You are not authorized to view post history.' });
    return;
  }

  const { limit = 25, source = 'all', pageId, status, postMethod } = req.query;
  const targetPageId = pageId || defaultPageId;

  try {
    const results = { mongoDbPosts: [], facebookPosts: [], combined: [] };

    // 1. Fetch posts from MongoDB
    if (source === 'all' || source === 'mongodb') {
      const mongoQuery = {};

      // Filter by status
      if (status && (status === 'sent' || status === 'failed')) {
        mongoQuery.status = status;
      } else {
        mongoQuery.status = { $in: ['sent', 'failed'] };
      }

      // Filter by postMethod
      if (postMethod && (postMethod === 'direct' || postMethod === 'scheduled')) {
        mongoQuery.postMethod = postMethod;
      }

      results.mongoDbPosts = await ScheduledFacebookPost.find(mongoQuery)
        .sort({ postedAt: -1, createdAt: -1 })
        .limit(parseInt(limit, 10))
        .lean()
        .exec();
      console.log(
        '[FacebookPost] MongoDB posts:',
        JSON.stringify(results.mongoDbPosts.slice(0, 2), null, 2),
      );
    }

    // 2. Fetch posts from Facebook Graph API
    // Note: Requires app to be in Live mode OR have Page Public Content Access feature
    if ((source === 'all' || source === 'facebook') && pageAccessToken && targetPageId) {
      try {
        const fbEndpoint = `${graphBaseUrl}/${targetPageId}/feed`;
        const fbResponse = await axios.get(fbEndpoint, {
          params: {
            access_token: pageAccessToken,
            fields:
              'id,message,created_time,permalink_url,full_picture,type,shares,reactions.summary(true),comments.summary(true)',
            limit: parseInt(limit, 10),
          },
        });

        results.facebookPosts = (fbResponse.data?.data || []).map((post) => ({
          postId: post.id,
          message: post.message || '(No text content)',
          createdTime: post.created_time,
          permalinkUrl: post.permalink_url,
          fullPicture: post.full_picture,
          type: post.type,
          shares: post.shares?.count || 0,
          reactions: post.reactions?.summary?.total_count || 0,
          comments: post.comments?.summary?.total_count || 0,
          source: 'facebook',
        }));
      } catch (fbError) {
        const fbErrorData = fbError.response?.data?.error;
        console.warn(
          '[FacebookPost] Graph API error (non-fatal):',
          fbErrorData?.message || fbError.message,
        );

        // Provide user-friendly message based on error code
        if (fbErrorData?.code === 10) {
          results.facebookApiError =
            'Facebook API access requires app to be in Live mode. Showing scheduled posts from database only.';
        } else if (fbErrorData?.code === 190) {
          results.facebookApiError = 'Facebook access token expired. Please generate a new token.';
        } else {
          results.facebookApiError = fbErrorData?.message || fbError.message;
        }
      }
    }

    // 3. Combine and sort by date (newest first)
    const mongoMapped = results.mongoDbPosts.map((p) => ({
      _id: p._id,
      postId: p.postId,
      message: p.message,
      createdTime: p.postedAt || p.createdAt,
      status: p.status,
      postType: p.postType,
      postMethod: p.postMethod || 'scheduled',
      link: p.link,
      imageUrl: p.imageUrl,
      lastError: p.lastError,
      source: 'mongodb',
    }));

    results.combined = [...mongoMapped, ...results.facebookPosts]
      .sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime))
      .slice(0, parseInt(limit, 10));

    res.status(200).send({
      success: true,
      posts: results.combined,
      mongoDbPosts: results.mongoDbPosts,
      facebookPosts: results.facebookPosts,
      facebookApiError: results.facebookApiError,
    });
  } catch (error) {
    console.error('[FacebookPost] getPostHistory error:', error.message);
    res.status(500).send({ error: 'Failed to fetch post history', details: error.message });
  }
};

/**
 * Cancels (deletes) a pending scheduled post.
 */
const cancelScheduledPost = async (req, res) => {
  const canPost = await hasPermission(req.body.requestor, 'postFacebookContent');
  const canSendEmails = await hasPermission(req.body.requestor, 'sendEmails');
  if (!canPost && !canSendEmails) {
    res.status(403).send({ error: 'You are not authorized to cancel scheduled posts.' });
    return;
  }

  const { postId } = req.params;

  if (!postId) {
    res.status(400).send({ error: 'postId is required.' });
    return;
  }

  try {
    const post = await ScheduledFacebookPost.findById(postId);

    if (!post) {
      res.status(404).send({ error: 'Scheduled post not found.' });
      return;
    }

    if (post.status !== 'pending') {
      res.status(400).send({
        error: `Cannot cancel a post with status "${post.status}". Only pending posts can be cancelled.`,
      });
      return;
    }

    await ScheduledFacebookPost.findByIdAndDelete(postId);

    res.status(200).send({ success: true, message: 'Scheduled post cancelled successfully.' });
  } catch (error) {
    console.error('[FacebookPost] cancelScheduledPost error:', error.message);
    res.status(500).send({ error: 'Failed to cancel scheduled post', details: error.message });
  }
};

/**
 * Updates a pending scheduled post (message, scheduledFor, link, imageUrl).
 */
const updateScheduledPost = async (req, res) => {
  const canPost = await hasPermission(req.body.requestor, 'postFacebookContent');
  const canSendEmails = await hasPermission(req.body.requestor, 'sendEmails');
  if (!canPost && !canSendEmails) {
    res.status(403).send({ error: 'You are not authorized to update scheduled posts.' });
    return;
  }

  const { postId } = req.params;
  const { message, scheduledFor, timezone, link, imageUrl } = req.body;

  if (!postId) {
    res.status(400).send({ error: 'postId is required.' });
    return;
  }

  try {
    const post = await ScheduledFacebookPost.findById(postId);

    if (!post) {
      res.status(404).send({ error: 'Scheduled post not found.' });
      return;
    }

    if (post.status !== 'pending') {
      res.status(400).send({
        error: `Cannot update a post with status "${post.status}". Only pending posts can be updated.`,
      });
      return;
    }

    // Validate new scheduledFor if provided
    if (scheduledFor) {
      const targetTimezone = timezone || post.timezone || PST_TIMEZONE;
      const scheduledMoment = moment.tz(scheduledFor, targetTimezone);

      if (!scheduledMoment.isValid()) {
        res.status(400).send({ error: 'Invalid scheduledFor date/time provided.' });
        return;
      }

      if (!scheduledMoment.isAfter(moment.tz(targetTimezone))) {
        res.status(400).send({ error: 'Scheduled time must be in the future.' });
        return;
      }

      post.scheduledFor = scheduledMoment.toDate();
      if (timezone) post.timezone = timezone;
    }

    if (message !== undefined) post.message = message;
    if (link !== undefined) post.link = link;
    if (imageUrl !== undefined) post.imageUrl = imageUrl;

    await post.save();

    res.status(200).send({ success: true, scheduledPost: post });
  } catch (error) {
    console.error('[FacebookPost] updateScheduledPost error:', error.message);
    res.status(500).send({ error: 'Failed to update scheduled post', details: error.message });
  }
};

module.exports = {
  publishToFacebook,
  postToFacebook,
  scheduleFacebookPost,
  getScheduledPosts,
  getPostHistory,
  cancelScheduledPost,
  updateScheduledPost,
};
