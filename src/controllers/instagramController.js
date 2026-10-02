const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const InstagramScheduledPost = require('../models/instagramScheduledPost');
const InstagramPostHistory = require('../models/instagramPostHistory');
const MetaToken = require('../models/metaToken');
const { publishInstagramPost } = require('../services/instagramServices');

const OBJECT_ID_PATTERN = /^[a-fA-F0-9]{24}$/;

function toValidObjectId(value) {
  if (typeof value !== 'string' || !OBJECT_ID_PATTERN.test(value)) {
    return null;
  }
  return new mongoose.Types.ObjectId(value);
}

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

const { saveBase64Media } = require('../services/saveMediaCloudinary');

const createPost = async (req, res) => {
  try {
    const userId = toValidObjectId(req.body?.requestor?.requestorId);
    if (!userId) {
      return res.status(401).json({ detail: 'Not authenticated' });
    }

    const { caption, media } = req.body;

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
    const { instagramAccountId, accessToken } = await getInstagramCredentials();
    const uploadedMedia = await saveBase64Media(media);

    const result = await publishInstagramPost({
      instagramAccountId,
      accessToken,
      caption: caption.trim(),
      mediaUrl: uploadedMedia.mediaUrl,
      mediaType: uploadedMedia.mediaType,
    });

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
    const graphError = err?.response?.data?.error?.message;

    let errorMessage = 'Unknown error';

    if (typeof graphError === 'string') {
      errorMessage = graphError;
    } else if (typeof err?.message === 'string') {
      errorMessage = err.message;
    }

    const safeErrorMessage = errorMessage.replace(/[\r\n\t]/g, ' ');

    console.error('[Instagram] Create post error:', safeErrorMessage);

    return res.status(500).json({
      error: errorMessage,
    });
  }
};

const schedulePost = async (req, res) => {
  try {
    const userId = toValidObjectId(req.body?.requestor?.requestorId);
    if (!userId) {
      return res.status(401).json({ detail: 'Not authenticated' });
    }

    const { caption, media, altText, scheduledTime, existingMediaUrl, existingMediaType } =
      req.body;

    if (!caption || !caption.trim()) {
      return res.status(400).json({
        error: 'Caption is required.',
      });
    }

    const hasNewMedia = Boolean(media && media.base64);
    const hasExistingMedia = Boolean(existingMediaUrl);

    if (!hasNewMedia && !hasExistingMedia) {
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

    // A real new upload gets saved/hosted as before. Editing without
    // re-uploading reuses the URL/type that's already public — media.base64
    // is null in that case since it came from an existing post, not a fresh file.
    const uploadedMedia = hasNewMedia
      ? await saveBase64Media(media)
      : { mediaUrl: existingMediaUrl, mediaType: existingMediaType || 'IMAGE' };

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
    const userId = toValidObjectId(req.body?.requestor?.requestorId);
    if (!userId) {
      return res.status(401).json({ detail: 'Not authenticated' });
    }
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
    const userId = toValidObjectId(req.body?.requestor?.requestorId);
    if (!userId) {
      return res.status(401).json({ detail: 'Not authenticated' });
    }

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
    const userId = toValidObjectId(req.body?.requestor?.requestorId);
    if (!userId) {
      return res.status(401).json({ detail: 'Not authenticated' });
    }
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
    const userId = toValidObjectId(req.body?.requestor?.requestorId);
    if (!userId) {
      return res.status(401).json({ detail: 'Not authenticated' });
    }

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
