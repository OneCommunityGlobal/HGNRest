const axios = require('axios');
const moment = require('moment-timezone');
const FormData = require('form-data');
const { Types: MongoTypes } = require('mongoose');
const ScheduledFacebookPost = require('../models/scheduledFacebookPost');
const FacebookConnection = require('../models/facebookConnections');
const { hasPermission } = require('../utilities/permissions');

const graphBaseUrl = process.env.FACEBOOK_GRAPH_URL || 'https://graph.facebook.com/v19.0';
const PST_TIMEZONE = 'America/Los_Angeles';

const ALLOWED_POST_STATUSES = ['pending', 'sending', 'sent', 'failed'];
const ALLOWED_POST_METHODS = ['direct', 'scheduled'];

const fallbackPageId = process.env.FACEBOOK_PAGE_ID;
const fallbackPageAccessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

const sanitizeFbId = (id) => String(id ?? '').replace(/[^\d]/g, '');

const assertValidFbId = (id) => {
  const cleaned = sanitizeFbId(id);
  if (!cleaned || !/^\d+$/.test(cleaned)) {
    const err = new Error('Invalid Facebook Page ID format. Must be numeric.');
    err.status = 400;
    throw err;
  }
  return cleaned;
};

const buildGraphPageUrl = (pageId, path) => {
  const safeId = assertValidFbId(pageId);
  return `${graphBaseUrl}/${safeId}/${path}`;
};

/**
 * Extracts requestor from request - handles both body (POST) and query (GET)
 */
const getRequestor = (req) => {
  if (req.body?.requestor) {
    return req.body.requestor;
  }

  if (req.query?.requestor) {
    try {
      return JSON.parse(req.query.requestor);
    } catch {
      return null;
    }
  }

  return null;
};

const getCredentials = async () => {
  const connection = await FacebookConnection.getActiveConnection();

  if (connection?.pageAccessToken) {
    return {
      pageId: connection.pageId,
      pageAccessToken: connection.pageAccessToken,
      source: 'oauth',
      pageName: connection.pageName,
    };
  }

  if (fallbackPageAccessToken && fallbackPageId) {
    return {
      pageId: fallbackPageId,
      pageAccessToken: fallbackPageAccessToken,
      source: 'env',
      pageName: null,
    };
  }

  return null;
};

const parseFormDataRequestor = (req) => {
  try {
    return req.body.requestor ? JSON.parse(req.body.requestor) : null;
  } catch {
    return req.body.requestor;
  }
};

const ensureFacebookPermission = async (requestor, res, errorMessage) => {
  const canPost = await hasPermission(requestor, 'postFacebookContent');
  const canSendEmails = await hasPermission(requestor, 'sendEmails');
  if (!canPost && !canSendEmails) {
    res.status(403).send({ error: errorMessage });
    return false;
  }
  return true;
};

const buildCreatedBy = (requestor) =>
  requestor
    ? {
        userId: requestor.requestorId,
        role: requestor.role,
        permissions: requestor.permissions,
      }
    : undefined;

const validateScheduleInput = (req, res, credentials) => {
  const { scheduledFor, timezone, pageId } = req.body;
  const targetTimezone = timezone || PST_TIMEZONE;

  if (!moment.tz.zone(targetTimezone)) {
    res.status(400).send({ error: 'Invalid timezone provided.' });
    return null;
  }

  if (!credentials) {
    res.status(500).send({
      error: 'Facebook is not connected. Please connect a Facebook Page in settings.',
    });
    return null;
  }

  let targetPageId;
  try {
    targetPageId = assertValidFbId(pageId || credentials.pageId);
  } catch (err) {
    res.status(err.status || 400).send({ error: err.message });
    return null;
  }

  const scheduledMoment = moment.tz(scheduledFor, targetTimezone);
  if (!scheduledMoment.isValid()) {
    res.status(400).send({ error: 'Invalid scheduledFor date/time provided.' });
    return null;
  }

  if (!scheduledMoment.isAfter(moment.tz(targetTimezone))) {
    res.status(400).send({ error: 'Scheduled time must be in the future (PST).' });
    return null;
  }

  return { targetPageId, scheduledMoment, targetTimezone };
};

const uploadImageToFacebook = async (
  endpoint,
  pageAccessToken,
  imageBuffer,
  imageMimeType,
  message,
) => {
  const formData = new FormData();
  formData.append('access_token', pageAccessToken);
  if (message) formData.append('message', message);

  const extMap = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
  };
  const ext = extMap[imageMimeType] || 'jpg';

  formData.append('source', imageBuffer, {
    filename: `upload.${ext}`,
    contentType: imageMimeType || 'image/jpeg',
  });

  console.log('[FacebookPost] Uploading image file to:', endpoint);
  return axios.post(endpoint, formData, {
    headers: formData.getHeaders(),
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });
};

const postPayloadToFacebook = async (endpoint, pageAccessToken, message, link, imageUrl) => {
  const payload = { access_token: pageAccessToken };
  if (message) payload.message = message;
  if (link) payload.link = link;
  if (imageUrl) payload.url = imageUrl;

  console.log('[FacebookPost] endpoint:', endpoint);
  return axios.post(endpoint, payload);
};

const applyScheduleUpdate = (post, scheduledFor, timezone) => {
  const targetTimezone = timezone || post.timezone || PST_TIMEZONE;
  const scheduledMoment = moment.tz(scheduledFor, targetTimezone);

  if (!scheduledMoment.isValid()) {
    throw new Error('Invalid scheduledFor date/time provided.');
  }

  if (!scheduledMoment.isAfter(moment.tz(targetTimezone))) {
    throw new Error('Scheduled time must be in the future.');
  }

  post.scheduledFor = scheduledMoment.toDate();
  if (timezone) post.timezone = timezone;
};

const publishToFacebook = async ({
  message,
  link,
  imageUrl,
  imageBuffer,
  imageMimeType,
  pageId,
}) => {
  const credentials = await getCredentials();

  if (!credentials) {
    const error = new Error(
      'Facebook is not connected. Please connect a Facebook Page in settings, or configure FACEBOOK_PAGE_ACCESS_TOKEN.',
    );
    error.status = 500;
    throw error;
  }

  let targetPageId;
  try {
    targetPageId = assertValidFbId(pageId || credentials.pageId);
  } catch (err) {
    if (!err.status) err.status = 400;
    throw err;
  }

  const { pageAccessToken } = credentials;

  console.log(
    '[FacebookPost] Using credentials from:',
    credentials.source,
    'pageId:',
    targetPageId,
  );

  if (!message && !link && !imageUrl && !imageBuffer) {
    const error = new Error(
      'message, link, imageUrl, or image file is required to create a Facebook post.',
    );
    error.status = 400;
    throw error;
  }

  const isDirectUpload = Boolean(imageBuffer);
  const isPhotoPost = isDirectUpload || Boolean(imageUrl);
  const endpoint = buildGraphPageUrl(targetPageId, isPhotoPost ? 'photos' : 'feed');

  try {
    const response = isDirectUpload
      ? await uploadImageToFacebook(endpoint, pageAccessToken, imageBuffer, imageMimeType, message)
      : await postPayloadToFacebook(endpoint, pageAccessToken, message, link, imageUrl);

    return {
      postId: response.data.id,
      postType: isPhotoPost ? 'photo' : 'feed',
    };
  } catch (error) {
    const fbError = error.response?.data?.error;
    console.error('[FacebookPost] error response:', fbError || error.message);
    const err = new Error(fbError?.message || error.message);
    err.status = error.response?.status || 500;
    err.details = fbError || error.message;
    throw err;
  }
};

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
    const credentials = await getCredentials();
    const directPost = new ScheduledFacebookPost({
      message,
      link,
      imageUrl,
      pageId: pageId || credentials?.pageId,
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
    console.error('[FacebookPost] Failed to save direct post to history:', error.message);
  }
};

const postToFacebook = async (req, res) => {
  if (
    !(await ensureFacebookPermission(
      req.body.requestor,
      res,
      'You are not authorized to post to Facebook.',
    ))
  )
    return;

  const { message, link, imageUrl, pageId } = req.body || {};

  try {
    const result = await publishToFacebook({ message, link, imageUrl, pageId });

    const credentials = await getCredentials();
    await saveDirectPostToHistory({
      message,
      link,
      imageUrl,
      pageId: pageId || credentials?.pageId,
      postId: result.postId,
      postType: result.postType,
      createdBy: buildCreatedBy(req.body.requestor),
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

const postToFacebookWithImage = async (req, res) => {
  const requestor = parseFormDataRequestor(req);

  if (
    !(await ensureFacebookPermission(requestor, res, 'You are not authorized to post to Facebook.'))
  )
    return;

  const { message, link, pageId } = req.body;
  const imageFile = req.file;

  if (!imageFile) {
    res.status(400).send({
      error: 'No image file provided. Use the regular post endpoint for URL-based images.',
    });
    return;
  }

  try {
    const result = await publishToFacebook({
      message,
      link,
      imageBuffer: imageFile.buffer,
      imageMimeType: imageFile.mimetype,
      pageId,
    });

    const credentials = await getCredentials();
    await saveDirectPostToHistory({
      message,
      link,
      imageUrl: `(uploaded: ${imageFile.originalname})`,
      pageId: pageId || credentials?.pageId,
      postId: result.postId,
      postType: result.postType,
      createdBy: buildCreatedBy(requestor),
    });

    res.status(200).send({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[FacebookPost] postToFacebookWithImage error:', error.message);
    res.status(error.status || 500).send({
      error: 'Failed to post to Facebook',
      details: error.details || error.message,
    });
  }
};

const scheduleFacebookPost = async (req, res) => {
  if (
    !(await ensureFacebookPermission(
      req.body.requestor,
      res,
      'You are not authorized to schedule Facebook posts.',
    ))
  )
    return;

  const { message, link, imageUrl } = req.body || {};
  if (!message && !imageUrl && !link) {
    res.status(400).send({
      error: 'At least one of message, imageUrl, or link is required to schedule a Facebook post.',
    });
    return;
  }

  const credentials = await getCredentials();
  const validation = validateScheduleInput(req, res, credentials);
  if (!validation) return;
  const { targetPageId, scheduledMoment, targetTimezone } = validation;

  try {
    const scheduledPost = new ScheduledFacebookPost({
      message,
      link,
      imageUrl,
      pageId: targetPageId,
      scheduledFor: scheduledMoment.toDate(),
      timezone: targetTimezone,
      createdBy: buildCreatedBy(req.body.requestor),
    });

    await scheduledPost.save();
    res.status(201).send({ success: true, scheduledPost });
  } catch (error) {
    console.error('[FacebookPost] schedule error:', error.message);
    res.status(500).send({ error: 'Failed to schedule Facebook post', details: error.message });
  }
};

/**
 * Schedules a Facebook post with direct image file upload.
 * Stores the image in MongoDB until posting time.
 */
const scheduleFacebookPostWithImage = async (req, res) => {
  const requestor = parseFormDataRequestor(req);

  if (
    !(await ensureFacebookPermission(
      requestor,
      res,
      'You are not authorized to schedule Facebook posts.',
    ))
  )
    return;

  const { message, link } = req.body;
  const imageFile = req.file;

  if (!message?.trim() && !imageFile) {
    res.status(400).send({ error: 'Message or image is required to schedule a Facebook post.' });
    return;
  }

  const credentials = await getCredentials();
  const validation = validateScheduleInput(req, res, credentials);
  if (!validation) return;
  const { targetPageId, scheduledMoment, targetTimezone } = validation;

  try {
    const scheduledPost = new ScheduledFacebookPost({
      message: message?.trim() || '',
      link: link?.trim() || undefined,
      pageId: targetPageId,
      scheduledFor: scheduledMoment.toDate(),
      timezone: targetTimezone,
      imageData: imageFile?.buffer || null,
      imageMimeType: imageFile?.mimetype || null,
      imageOriginalName: imageFile?.originalname || null,
      createdBy: buildCreatedBy(requestor),
    });

    await scheduledPost.save();

    const responsePost = scheduledPost.toObject();
    delete responsePost.imageData;
    responsePost.hasImage = Boolean(imageFile);

    res.status(201).send({ success: true, scheduledPost: responsePost });
  } catch (error) {
    console.error('[FacebookPost] schedule with image error:', error.message);
    res.status(500).send({ error: 'Failed to schedule Facebook post', details: error.message });
  }
};

const getScheduledPosts = async (req, res) => {
  const requestor = getRequestor(req);
  const canPost = await hasPermission(requestor, 'postFacebookContent');
  const canSendEmails = await hasPermission(requestor, 'sendEmails');
  if (!canPost && !canSendEmails) {
    res.status(403).send({ error: 'You are not authorized to view scheduled posts.' });
    return;
  }

  const { status: rawStatus, limit = 50, skip = 0 } = req.query;
  const safeStatus =
    typeof rawStatus === 'string' && ALLOWED_POST_STATUSES.includes(rawStatus) ? rawStatus : null;
  const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 50, 1), 200);
  const safeSkip = Math.max(Number.parseInt(skip, 10) || 0, 0);

  try {
    const query = {};
    if (safeStatus) {
      query.status = safeStatus;
    } else {
      query.status = { $in: ['pending', 'sending'] };
    }

    const scheduledPosts = await ScheduledFacebookPost.find(query)
      .select('-imageData')
      .sort({ scheduledFor: 1 })
      .skip(safeSkip)
      .limit(safeLimit)
      .lean()
      .exec();
    const postsWithImageFlag = scheduledPosts.map((p) => ({
      ...p,
      hasImage: Boolean(p.imageMimeType),
    }));

    const total = await ScheduledFacebookPost.countDocuments(query);

    res.status(200).send({
      success: true,
      scheduledPosts: postsWithImageFlag,
      pagination: { total, limit: safeLimit, skip: safeSkip },
    });
  } catch (error) {
    console.error('[FacebookPost] getScheduledPosts error:', error.message);
    res.status(500).send({ error: 'Failed to fetch scheduled posts', details: error.message });
  }
};

const buildMongoHistoryQuery = (status, postMethod) => {
  const query = {};
  const safeStatus =
    typeof status === 'string' && (status === 'sent' || status === 'failed') ? status : null;
  query.status = safeStatus || { $in: ['sent', 'failed'] };
  if (typeof postMethod === 'string' && ALLOWED_POST_METHODS.includes(postMethod)) {
    query.postMethod = postMethod;
  }
  return query;
};

const fetchFacebookFeedPosts = async (credentials, targetPageId, limit) => {
  try {
    const fbEndpoint = buildGraphPageUrl(targetPageId, 'feed');
    const fbResponse = await axios.get(fbEndpoint, {
      params: {
        access_token: credentials.pageAccessToken,
        fields:
          'id,message,created_time,permalink_url,full_picture,type,shares,reactions.summary(true),comments.summary(true)',
        limit: Number.parseInt(limit, 10),
      },
    });
    const posts = (fbResponse.data?.data || []).map((post) => ({
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
    return { posts, apiError: null };
  } catch (fbError) {
    const fbErrorData = fbError.response?.data?.error;
    console.warn('[FacebookPost] Graph API error:', fbErrorData?.message || fbError.message);
    let apiError;
    if (fbErrorData?.code === 10) {
      apiError =
        'Facebook API access requires app to be in Live mode. Showing database posts only.';
    } else if (fbErrorData?.code === 190) {
      apiError = 'Facebook access token expired. Please reconnect your Facebook Page.';
    } else {
      apiError = fbErrorData?.message || fbError.message;
    }
    return { posts: [], apiError };
  }
};

const mapMongoPostForHistory = (p) => ({
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
});

const getPostHistory = async (req, res) => {
  const requestor = getRequestor(req);
  const canPost = await hasPermission(requestor, 'postFacebookContent');
  const canSendEmails = await hasPermission(requestor, 'sendEmails');
  if (!canPost && !canSendEmails) {
    res.status(403).send({ error: 'You are not authorized to view post history.' });
    return;
  }

  const { limit = 25, source = 'all', pageId, status, postMethod } = req.query;
  const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 25, 1), 200);
  const credentials = await getCredentials();

  let targetPageId = null;
  let facebookApiError;
  try {
    targetPageId = assertValidFbId(pageId || credentials?.pageId);
  } catch {
    facebookApiError = 'No valid Facebook Page ID available. Showing database posts only.';
  }

  try {
    let mongoDbPosts = [];
    let facebookPosts = [];

    if (source === 'all' || source === 'mongodb') {
      mongoDbPosts = await ScheduledFacebookPost.find(buildMongoHistoryQuery(status, postMethod))
        .select('-imageData')
        .sort({ postedAt: -1, createdAt: -1 })
        .limit(safeLimit)
        .lean()
        .exec();
    }

    if ((source === 'all' || source === 'facebook') && credentials && targetPageId) {
      const { posts, apiError } = await fetchFacebookFeedPosts(
        credentials,
        targetPageId,
        safeLimit,
      );
      facebookPosts = posts;
      facebookApiError = apiError;
    }

    const combined = [...mongoDbPosts.map(mapMongoPostForHistory), ...facebookPosts]
      .sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime))
      .slice(0, safeLimit);

    res.status(200).send({
      success: true,
      posts: combined,
      facebookApiError,
      credentialsSource: credentials?.source || 'none',
    });
  } catch (error) {
    console.error('[FacebookPost] getPostHistory error:', error.message);
    res.status(500).send({ error: 'Failed to fetch post history', details: error.message });
  }
};

const cancelScheduledPost = async (req, res) => {
  if (
    !(await ensureFacebookPermission(
      req.body.requestor,
      res,
      'You are not authorized to cancel scheduled posts.',
    ))
  )
    return;

  const { postId } = req.params;

  if (!postId) {
    res.status(400).send({ error: 'postId is required.' });
    return;
  }

  if (!MongoTypes.ObjectId.isValid(postId)) {
    res.status(400).send({ error: 'Invalid postId format.' });
    return;
  }

  try {
    const safePostId = new MongoTypes.ObjectId(postId);
    const post = await ScheduledFacebookPost.findById(safePostId);

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

    await ScheduledFacebookPost.findByIdAndDelete(safePostId);

    res.status(200).send({ success: true, message: 'Scheduled post cancelled successfully.' });
  } catch (error) {
    console.error('[FacebookPost] cancelScheduledPost error:', error.message);
    res.status(500).send({ error: 'Failed to cancel scheduled post', details: error.message });
  }
};

const updateScheduledPost = async (req, res) => {
  if (
    !(await ensureFacebookPermission(
      req.body.requestor,
      res,
      'You are not authorized to update scheduled posts.',
    ))
  )
    return;

  const { postId } = req.params;
  const { message, scheduledFor, timezone, link, imageUrl } = req.body;

  if (!postId) {
    res.status(400).send({ error: 'postId is required.' });
    return;
  }

  if (!MongoTypes.ObjectId.isValid(postId)) {
    res.status(400).send({ error: 'Invalid postId format.' });
    return;
  }

  try {
    const safePostId = new MongoTypes.ObjectId(postId);
    const post = await ScheduledFacebookPost.findById(safePostId);

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

    if (scheduledFor) {
      try {
        applyScheduleUpdate(post, scheduledFor, timezone);
      } catch (validationError) {
        res.status(400).send({ error: validationError.message });
        return;
      }
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
  postToFacebookWithImage,
  scheduleFacebookPost,
  scheduleFacebookPostWithImage,
  getScheduledPosts,
  getPostHistory,
  cancelScheduledPost,
  updateScheduledPost,
  getCredentials,
};
