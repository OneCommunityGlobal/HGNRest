const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const InstagramScheduledPost = require('../models/instagramScheduledPost');
const InstagramPostHistory = require('../models/instagramPostHistory');
const MetaToken = require('../models/metaToken');
const { publishInstagramPost } = require('../services/instagramServices');

const getInstagramCredentials = async () => {
  const tokenDoc = await MetaToken.findOne({ platform: 'instagram' });

  if (!tokenDoc || tokenDoc.expiresAt < new Date()) {
    throw new Error('Instagram access token is missing or expired. Refresh required.');
  }

  return {
    instagramAccountId: process.env.INSTAGRAM_ACCOUNT_ID, // this doesn't expire, fine to keep in env
    accessToken: tokenDoc.accessToken,
  };
};

const saveBase64Media = async (media) => {
  if (!media || !media.base64) {
    throw new Error('Media is required.');
  }

  const match = media.base64.match(/^data:(image\/[^;]+|video\/[^;]+);base64,(.+)$/);

  if (!match) {
    throw new Error('Invalid media data.');
  }

  const mimeType = match[1];
  const base64Data = match[2];

  const extension = mimeType.split('/')[1] || 'bin';

  const fileName = `${crypto.randomUUID()}.${extension}`;

  const uploadDirectory = path.join(process.cwd(), 'uploads', 'instagram');

  fs.mkdirSync(uploadDirectory, {
    recursive: true,
  });

  const filePath = path.join(uploadDirectory, fileName);

  fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

  /*
   * This URL MUST be publicly accessible to Meta.
   *
   * Configure INSTAGRAM_MEDIA_BASE_URL to point
   * to your public backend URL.
   */

  const baseUrl = process.env.INSTAGRAM_MEDIA_BASE_URL;

  if (!baseUrl) {
    throw new Error('INSTAGRAM_MEDIA_BASE_URL is not configured.');
  }

  return {
    mediaUrl: `${baseUrl}/uploads/instagram/${fileName}`,

    mediaType: mimeType.startsWith('video') ? 'VIDEO' : 'IMAGE',
  };
};

const createPost = async (req, res) => {
  try {
    const { caption, media, altText } = req.body;

    if (!caption || !caption.trim()) {
      return res.status(400).json({
        error: 'Caption is required.',
      });
    }

    if (!media || !media.base64) {
      return res.status(400).json({
        error: 'Media is required.',
      });
    }

    const { instagramAccountId, accessToken } = await getInstagramCredentials(req);

    const uploadedMedia = await saveBase64Media(media);

    const result = await publishInstagramPost({
      instagramAccountId,
      accessToken,
      caption: caption.trim(),
      mediaUrl: uploadedMedia.mediaUrl,
      mediaType: uploadedMedia.mediaType,
    });

    const userId = req.body?.requestor?.requestorId;

    await InstagramPostHistory.create({
      userId,
      caption: caption.trim(),
      mediaUrl: uploadedMedia.mediaUrl,
      mediaType: uploadedMedia.mediaType,
      instagramMediaId: result.instagramMediaId,
      permalink: result.permalink,
      postedAt: new Date(),
      status: 'published',
    });

    return res.status(200).json({
      success: true,
      creationId: result.creationId,
      instagramMediaId: result.instagramMediaId,
      permalink: result.permalink,
    });
  } catch (err) {
    console.error('[Instagram] Create post error:', err.response?.data || err.message);

    return res.status(500).json({
      error: err.response?.data?.error?.message || err.message || 'Failed to post to Instagram.',
    });
  }
};

const schedulePost = async (req, res) => {
  try {
    const { caption, media, altText, scheduledTime } = req.body;

    if (!caption || !caption.trim()) {
      return res.status(400).json({
        error: 'Caption is required.',
      });
    }

    if (!media || !media.base64) {
      return res.status(400).json({
        error: 'Media is required.',
      });
    }

    if (!scheduledTime) {
      return res.status(400).json({
        error: 'Scheduled time is required.',
      });
    }

    const scheduledDate = new Date(scheduledTime);

    if (Number.isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
      return res.status(400).json({
        error: 'Scheduled time must be in the future.',
      });
    }

    const uploadedMedia = await saveBase64Media(media);

    const userId = req.body?.requestor?.requestorId;

    const post = await InstagramScheduledPost.create({
      userId,
      caption: caption.trim(),
      mediaUrl: uploadedMedia.mediaUrl,
      mediaType: uploadedMedia.mediaType,
      mediaAltText: altText || null,
      scheduledTime: scheduledDate,
      status: 'scheduled',
    });

    return res.status(201).json({
      message: 'Post scheduled.',
      post,
    });
  } catch (err) {
    console.error('[Instagram] Schedule error:', err.message);

    return res.status(500).json({
      error: err.message,
    });
  }
};

const getScheduledPosts = async (req, res) => {
  try {
    const userId = req.body?.requestor?.requestorId;

    const posts = await InstagramScheduledPost.find({
      userId,
      status: {
        $in: ['scheduled', 'publishing', 'failed'],
      },
    })
      .sort({ scheduledTime: 1 })
      .lean();

    return res.status(200).json(posts);
  } catch (err) {
    return res.status(500).json({
      error: err.message,
    });
  }
};

const deleteScheduledPost = async (req, res) => {
  try {
    const userId = req.body?.requestor?.requestorId;

    const post = await InstagramScheduledPost.findOneAndDelete({
      _id: req.params.id,
      userId,
    });

    if (!post) {
      return res.status(404).json({
        error: 'Scheduled post not found.',
      });
    }

    return res.status(200).json({
      message: 'Deleted.',
    });
  } catch (err) {
    return res.status(500).json({
      error: err.message,
    });
  }
};

const getHistory = async (req, res) => {
  try {
    const userId = req.body?.requestor?.requestorId;
    const limit = Math.min(Number(req.query.limit) || 20, 100);

    const history = await InstagramPostHistory.find({
      userId,
    })
      .sort({ postedAt: -1 })
      .limit(limit)
      .lean();

    return res.status(200).json(history);
  } catch (err) {
    return res.status(500).json({
      error: err.message,
    });
  }
};

const retryScheduledPost = async (req, res) => {
  try {
    const userId = req.body?.requestor?.requestorId;

    const post = await InstagramScheduledPost.findOne({
      _id: req.params.id,
      userId,
    });

    if (!post) {
      return res.status(404).json({
        error: 'Scheduled post not found.',
      });
    }

    post.status = 'scheduled';
    post.lastError = null;

    await post.save();

    return res.status(200).json({
      message: 'Post re-queued.',
      post,
    });
  } catch (err) {
    return res.status(500).json({
      error: err.message,
    });
  }
};

module.exports = {
  createPost,
  schedulePost,
  getScheduledPosts,
  deleteScheduledPost,
  getHistory,
  retryScheduledPost,
};
