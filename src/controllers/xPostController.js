const XScheduledPost = require('../models/xScheduledPost');
const { hasPermission } = require('../utilities/permissions');
const {
  asyncRoute,
  ValidationError,
  NotFoundError,
  validateContent,
  applyUpdates,
  X_MAX_CONTENT_LENGTH,
} = require('../helpers/xPostHelpers');

const ELEVATED_ROLES = new Set(['Owner', 'Administrator']);

const authorizeXRequest = async (req) => {
  const requestor = req.body?.requestor;
  if (!requestor?.requestorId) {
    const error = new Error('Missing requestor');
    error.status = 401;
    throw error;
  }

  const isElevated = ELEVATED_ROLES.has(requestor.role);
  if (!isElevated && !(await hasPermission(requestor, 'sendEmails'))) {
    const error = new Error('You are not authorized to manage X posts.');
    error.status = 403;
    throw error;
  }

  return { requestorId: requestor.requestorId, isElevated };
};

const getRequestorOwnedSelector = (id, authorization) =>
  authorization.isElevated ? { _id: id } : { _id: id, createdBy: authorization.requestorId };

const requireFutureDate = (value, msg = 'scheduledAt must be in the future') => {
  if (new Date(value) <= new Date()) throw new ValidationError(msg);
};

exports.createPost = asyncRoute(async (req, res) => {
  const { requestorId } = await authorizeXRequest(req);
  const { content } = req.body;
  validateContent(content);
  const now = new Date();
  const doc = await XScheduledPost.create({
    content,
    scheduledAt: now,
    status: 'ready',
    createdBy: requestorId,
  });
  return res.status(201).json({
    message: 'Post staged successfully',
    postId: doc._id,
    intentUrl: `https://x.com/intent/tweet?text=${encodeURIComponent(content)}`,
  });
});

exports.schedulePost = asyncRoute(async (req, res) => {
  const { requestorId } = await authorizeXRequest(req);
  const { content, scheduledAt, mediaBase64, altText } = req.body;
  validateContent(content);
  if (!scheduledAt) throw new ValidationError('scheduledAt is required');
  requireFutureDate(scheduledAt);
  const doc = await XScheduledPost.create({
    content,
    scheduledAt: new Date(scheduledAt),
    mediaBase64: mediaBase64 || null,
    altText: altText || '',
    createdBy: requestorId,
  });
  return res.status(201).json({ message: 'Post scheduled', post: doc });
});

exports.getScheduled = asyncRoute(async (req, res) => {
  const authorization = await authorizeXRequest(req);
  const filter = { status: { $in: ['pending', 'ready', 'skipped'] } };
  if (!authorization.isElevated) filter.createdBy = authorization.requestorId;
  const posts = await XScheduledPost.find(filter).sort({ scheduledAt: 1 }).lean();
  return res.json(posts);
});

exports.deleteScheduled = asyncRoute(async (req, res) => {
  const authorization = await authorizeXRequest(req);
  const selector = getRequestorOwnedSelector(req.params.id, authorization);
  const doc = await XScheduledPost.findOneAndDelete(selector);
  if (!doc) throw new NotFoundError('Scheduled post not found');
  return res.json({ message: 'Scheduled post cancelled' });
});

exports.getHistory = asyncRoute(async (req, res) => {
  const authorization = await authorizeXRequest(req);
  const filter = { status: 'posted' };
  if (!authorization.isElevated) filter.createdBy = authorization.requestorId;
  const rawLimit = req.query?.limit;
  const parsedLimit =
    typeof rawLimit === 'string' && /^\d+$/.test(rawLimit) ? Number(rawLimit) : null;
  const hasValidLimit = Number.isSafeInteger(parsedLimit) && parsedLimit > 0;

  const postsQuery = XScheduledPost.find(filter).sort({ postedAt: -1 });
  if (hasValidLimit) postsQuery.limit(parsedLimit);

  const [posts, total] = await Promise.all([
    postsQuery.lean(),
    XScheduledPost.countDocuments(filter),
  ]);
  return res.json({ posts, total });
});

exports.markAsPosted = asyncRoute(async (req, res) => {
  const authorization = await authorizeXRequest(req);
  const selector = getRequestorOwnedSelector(req.params.id, authorization);
  const doc = await XScheduledPost.findOneAndUpdate(
    selector,
    { status: 'posted', postedAt: new Date() },
    { new: true },
  );
  if (!doc) throw new NotFoundError('Scheduled post not found');
  return res.json(doc);
});

exports.updateScheduledPost = asyncRoute(async (req, res) => {
  const authorization = await authorizeXRequest(req);
  const selector = getRequestorOwnedSelector(req.params.id, authorization);
  const doc = await XScheduledPost.findOne(selector);
  if (!doc) throw new NotFoundError('Scheduled post not found');
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
  const authorization = await authorizeXRequest(req);
  const selector = getRequestorOwnedSelector(req.params.id, authorization);
  const doc = await XScheduledPost.findOneAndUpdate(selector, { status: 'skipped' }, { new: true });
  if (!doc) throw new NotFoundError('Scheduled post not found');
  return res.json(doc);
});
