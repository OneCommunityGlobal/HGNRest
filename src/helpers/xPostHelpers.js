const ValidationError = require('./xValidationError');
const NotFoundError = require('./xNotFoundError');

const X_MAX_CONTENT_LENGTH = 280;

const asyncRoute = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (err) {
    if (err instanceof ValidationError || err instanceof NotFoundError) {
      return res.status(err.status).json({ error: err.message });
    }
    return res.status(err.status || 500).json({ error: err.message });
  }
};

const validateContent = (content, requiredMsg, tooLongMsg, maxLen = X_MAX_CONTENT_LENGTH) => {
  if (!content || typeof content !== 'string') {
    throw new ValidationError(requiredMsg || 'content is required');
  }
  if (content.length > maxLen) {
    throw new ValidationError(tooLongMsg || `Content exceeds ${maxLen} characters`);
  }
};

const findPostOr404 = async (Model, id, notFoundMsg = 'Scheduled post not found') => {
  const doc = await Model.findById(id);
  if (!doc) throw new NotFoundError(notFoundMsg);
  return doc;
};

const applyUpdates = (doc, body, allowedFields) => {
  allowedFields.forEach((field) => {
    if (body[field] !== undefined) doc[field] = body[field];
  });
};

module.exports = {
  asyncRoute,
  ValidationError,
  NotFoundError,
  validateContent,
  findPostOr404,
  applyUpdates,
  X_MAX_CONTENT_LENGTH,
};
