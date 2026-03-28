const XScheduledPost = require('../models/xScheduledPost');

async function createPost(req, res) {
  const { content } = req.body;
  if (!content || typeof content !== 'string') {
    return res.status(400).json({ error: 'content is required' });
  }
  if (content.length > 280) {
    return res.status(400).json({ error: 'Content exceeds 280 characters' });
  }

  try {
    const now = new Date();
    const doc = await XScheduledPost.create({
      content,
      scheduledAt: now,
      status: 'posted',
      postedAt: now,
      createdBy: req.user?._id,
    });
    return res.status(201).json({
      message: 'Post staged successfully',
      postId: doc._id,
      intentUrl: `https://x.com/intent/tweet?text=${encodeURIComponent(content)}`,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function schedulePost(req, res) {
  const { content, scheduledAt, mediaBase64, altText } = req.body;
  if (!content || typeof content !== 'string') {
    return res.status(400).json({ error: 'content is required' });
  }
  if (content.length > 280) {
    return res.status(400).json({ error: 'Content exceeds 280 characters' });
  }
  if (!scheduledAt) {
    return res.status(400).json({ error: 'scheduledAt is required' });
  }
  if (new Date(scheduledAt) <= new Date()) {
    return res.status(400).json({ error: 'scheduledAt must be in the future' });
  }

  try {
    const doc = await XScheduledPost.create({
      content,
      scheduledAt: new Date(scheduledAt),
      mediaBase64: mediaBase64 || null,
      altText: altText || '',
      createdBy: req.user?._id,
    });
    return res.status(201).json({ message: 'Post scheduled', post: doc });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function getScheduled(req, res) {
  try {
    const posts = await XScheduledPost.find({ status: { $in: ['pending', 'ready'] } })
      .sort({ scheduledAt: 1 })
      .lean();
    return res.json(posts);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function deleteScheduled(req, res) {
  try {
    const doc = await XScheduledPost.findByIdAndDelete(req.params.id);
    if (!doc) {
      return res.status(404).json({ error: 'Scheduled post not found' });
    }
    return res.json({ message: 'Scheduled post cancelled' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function getHistory(req, res) {
  try {
    const posts = await XScheduledPost.find({ status: 'posted' }).sort({ postedAt: -1 }).lean();
    return res.json(posts);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function markAsPosted(req, res) {
  try {
    const doc = await XScheduledPost.findByIdAndUpdate(
      req.params.id,
      { status: 'posted', postedAt: new Date() },
      { new: true },
    );
    if (!doc) {
      return res.status(404).json({ error: 'Scheduled post not found' });
    }
    return res.json(doc);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function updateScheduledPost(req, res) {
  try {
    const doc = await XScheduledPost.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ error: 'Scheduled post not found' });
    }
    if (doc.status !== 'pending' && doc.status !== 'ready') {
      return res.status(400).json({ error: `Cannot edit a post with status: ${doc.status}` });
    }

    const { content, scheduledAt, mediaBase64, altText } = req.body;

    if (content !== undefined) {
      if (typeof content !== 'string' || content.length > 280) {
        return res
          .status(400)
          .json({ error: 'Content must be a string of 280 characters or fewer' });
      }
      doc.content = content;
    }
    if (scheduledAt !== undefined) {
      if (new Date(scheduledAt) <= new Date()) {
        return res.status(400).json({ error: 'scheduledAt must be in the future' });
      }
      doc.scheduledAt = new Date(scheduledAt);
    }
    if (mediaBase64 !== undefined) {
      doc.mediaBase64 = mediaBase64;
    }
    if (altText !== undefined) {
      doc.altText = altText;
    }

    await doc.save();
    return res.json(doc);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function skipPost(req, res) {
  try {
    const doc = await XScheduledPost.findByIdAndUpdate(
      req.params.id,
      { status: 'skipped' },
      { new: true },
    );
    if (!doc) {
      return res.status(404).json({ error: 'Scheduled post not found' });
    }
    return res.json(doc);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports = {
  createPost,
  schedulePost,
  getScheduled,
  deleteScheduled,
  getHistory,
  markAsPosted,
  updateScheduledPost,
  skipPost,
};
