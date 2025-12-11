const axios = require('axios');
const { hasPermission } = require('../utilities/permissions');

const graphBaseUrl = process.env.FACEBOOK_GRAPH_URL || 'https://graph.facebook.com/v19.0';
const defaultPageId = process.env.FACEBOOK_PAGE_ID;
const pageAccessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

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

  if (!pageAccessToken) {
    res.status(500).send({ error: 'FACEBOOK_PAGE_ACCESS_TOKEN is not configured on the server.' });
    return;
  }

  const { message, link, imageUrl, pageId } = req.body || {};
  const targetPageId = pageId || defaultPageId;

  // Debug (non-secret) logging to help diagnose config issues
  console.log(
    '[FacebookPost] targetPageId:',
    targetPageId || '(none)',
    'tokenSet:',
    Boolean(pageAccessToken),
  );

  if (!targetPageId) {
    res.status(400).send({
      error: 'No Facebook page id provided. Supply pageId in the request or set FACEBOOK_PAGE_ID.',
    });
    return;
  }

  if (!message && !link && !imageUrl) {
    res
      .status(400)
      .send({ error: 'message, link, or imageUrl is required to create a Facebook post.' });
    return;
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
    res.status(200).send({
      success: true,
      postId: response.data.id,
      postType: isPhotoPost ? 'photo' : 'feed',
    });
  } catch (error) {
    const statusCode = error.response?.status || 500;
    const fbError = error.response?.data?.error;
    console.error('[FacebookPost] error response:', fbError || error.message);
    res.status(statusCode).send({
      error: 'Failed to post to Facebook',
      details: fbError || error.message,
    });
  }
};

module.exports = {
  postToFacebook,
};
