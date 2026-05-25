const XScheduledPost = require('../models/xScheduledPost');
const {
  asyncRoute,
  ValidationError,
  NotFoundError,
  validateContent,
  findPostOr404,
  applyUpdates,
  X_MAX_CONTENT_LENGTH,
} = require('../helpers/xPostHelpers');

const requireFutureDate = (value, msg = 'scheduledAt must be in the future') => {
  if (new Date(value) <= new Date()) throw new ValidationError(msg);
};

exports.createPost = asyncRoute(async (req, res) => {
  const { content } = req.body;
  validateContent(content);
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
});

exports.schedulePost = asyncRoute(async (req, res) => {
  const { content, scheduledAt, mediaBase64, altText } = req.body;
  validateContent(content);
  if (!scheduledAt) throw new ValidationError('scheduledAt is required');
  requireFutureDate(scheduledAt);
  const doc = await XScheduledPost.create({
    content,
    scheduledAt: new Date(scheduledAt),
    mediaBase64: mediaBase64 || null,
    altText: altText || '',
    createdBy: req.user?._id,
  });
  return res.status(201).json({ message: 'Post scheduled', post: doc });
});

exports.getScheduled = asyncRoute(async (req, res) => {
  const posts = await XScheduledPost.find({ status: { $in: ['pending', 'ready'] } })
    .sort({ scheduledAt: 1 })
    .lean();
  return res.json(posts);
});

exports.deleteScheduled = asyncRoute(async (req, res) => {
  const doc = await XScheduledPost.findByIdAndDelete(req.params.id);
  if (!doc) throw new NotFoundError('Scheduled post not found');
  return res.json({ message: 'Scheduled post cancelled' });
});

exports.getHistory = asyncRoute(async (req, res) => {
  const posts = await XScheduledPost.find({ status: 'posted' }).sort({ postedAt: -1 }).lean();
  return res.json(posts);
});

exports.markAsPosted = asyncRoute(async (req, res) => {
  const doc = await XScheduledPost.findByIdAndUpdate(
    req.params.id,
    { status: 'posted', postedAt: new Date() },
    { new: true },
  );
  if (!doc) throw new NotFoundError('Scheduled post not found');
  return res.json(doc);
});

exports.updateScheduledPost = asyncRoute(async (req, res) => {
  const doc = await findPostOr404(XScheduledPost, req.params.id);
  if (doc.status !== 'pending' && doc.status !== 'ready') {
    throw new ValidationError(`Cannot edit a post with status: ${doc.status}`);
  }
  const { content, scheduledAt } = req.body;
  if (
    content !== undefined &&
    (typeof content !== 'string' || content.length > X_MAX_CONTENT_LENGTH)
  ) {
    throw new ValidationError('Content must be a string of 280 characters or fewer');
  }
  if (scheduledAt !== undefined) {
    requireFutureDate(scheduledAt);
    req.body.scheduledAt = new Date(scheduledAt);
  }
  applyUpdates(doc, req.body, ['content', 'scheduledAt', 'mediaBase64', 'altText']);
  await doc.save();
  return res.json(doc);
});

exports.skipPost = asyncRoute(async (req, res) => {
  const doc = await XScheduledPost.findByIdAndUpdate(
    req.params.id,
    { status: 'skipped' },
    { new: true },
  );
  if (!doc) throw new NotFoundError('Scheduled post not found');
  return res.json(doc);
});
