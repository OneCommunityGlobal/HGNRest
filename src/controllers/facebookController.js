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
 * Posts content to a Facebook Page using the Graph API.
 * Supports simple feed posts (message/link) or photo posts (imageUrl + optional message).
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

module.exports = {
  publishToFacebook,
  postToFacebook,
  scheduleFacebookPost,
};
