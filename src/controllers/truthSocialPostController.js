const axios = require('axios');
const TruthSocialScheduledPost = require('../models/truthSocialScheduledPost');
const TruthSocialPostHistory = require('../models/truthSocialPostHistory');

const TRUTH_SOCIAL_API = 'https://truthsocial.com/api/v1';

// Post to Truth Social (proxied through backend to avoid CORS)
const createPost = async (req, res) => {
  try {
    const { content, visibility, accessToken } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    if (!accessToken) {
      return res.status(400).json({ error: 'Access token is required' });
    }

    console.log('[TruthSocial] Posting via backend proxy...');

    const response = await axios.post(
      `${TRUTH_SOCIAL_API}/statuses`,
      {
        status: content,
        visibility: visibility || 'public',
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        timeout: 15000,
      },
    );

    console.log('[TruthSocial] Post successful!');
    return res.status(200).json(response.data);
  } catch (err) {
    console.error('[TruthSocial] Post error:', err.response?.data || err.message);

    if (err.response) {
      return res.status(err.response.status).json({
        error: err.response.data?.error || err.response.statusText || 'Failed to post',
        details: err.response.data,
      });
    }

    return res.status(500).json({ error: err.message });
  }
};

// Verify token
const verifyToken = async (req, res) => {
  try {
    const { accessToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({ error: 'Access token is required' });
    }

    const response = await axios.get(`${TRUTH_SOCIAL_API}/accounts/verify_credentials`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 10000,
    });

    return res.status(200).json({
      success: true,
      username: response.data.username,
      displayName: response.data.display_name,
    });
  } catch (err) {
    console.error('[TruthSocial] Verify error:', err.response?.data || err.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Save to history
const saveHistory = async (req, res) => {
  try {
    const { subject, content, visibility, tags, truthSocialPostId } = req.body;

    const historyEntry = await TruthSocialPostHistory.create({
      subject,
      content,
      visibility,
      tags,
      postedAt: new Date(),
      truthSocialPostId,
    });

    return res.status(201).json(historyEntry);
  } catch (err) {
    console.error('Error saving history:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

// Get post history
const getPostHistory = async (req, res) => {
  try {
    const history = await TruthSocialPostHistory.find().sort({ postedAt: -1 }).limit(50).lean();
    return res.status(200).json(history);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// Schedule a post
const schedulePost = async (req, res) => {
  try {
    const { subject, content, visibility, tags, scheduledTime } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    if (!scheduledTime) {
      return res.status(400).json({ error: 'Scheduled time is required' });
    }

    const scheduledDate = new Date(scheduledTime);

    const newPost = await TruthSocialScheduledPost.create({
      subject,
      content,
      visibility: visibility || 'public',
      tags,
      scheduledTime: scheduledDate,
      status: 'pending',
    });

    return res.status(201).json({ message: 'Post scheduled!', post: newPost });
  } catch (err) {
    console.error('[Schedule] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

// Get all scheduled posts
const getScheduledPosts = async (req, res) => {
  try {
    const posts = await TruthSocialScheduledPost.find({ status: 'pending' })
      .sort({ scheduledTime: 1 })
      .lean();
    return res.status(200).json(posts);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// Delete a scheduled post
const deleteScheduledPost = async (req, res) => {
  try {
    const { id } = req.params;
    await TruthSocialScheduledPost.findByIdAndDelete(id);
    return res.status(200).json({ message: 'Deleted' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// Update a scheduled post
const updateScheduledPost = async (req, res) => {
  try {
    const { id } = req.params;
    const { subject, content, visibility, tags, scheduledTime } = req.body;

    const updateData = {
      subject,
      content,
      visibility,
      tags,
    };

    if (scheduledTime) {
      updateData.scheduledTime = new Date(scheduledTime);
    }

    const updatedPost = await TruthSocialScheduledPost.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    return res.status(200).json({ message: 'Updated!', post: updatedPost });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  createPost,
  verifyToken,
  saveHistory,
  getPostHistory,
  schedulePost,
  getScheduledPosts,
  deleteScheduledPost,
  updateScheduledPost,
};
