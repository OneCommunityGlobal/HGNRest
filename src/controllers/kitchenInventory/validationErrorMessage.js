// Turns a Mongoose validation/cast error into a message the frontend can show.
// Returns null for any other error so callers can fall back to a generic response.
const getValidationErrorMessage = (err) => {
  if (err?.name === 'ValidationError') {
    return Object.values(err.errors)
      .map((fieldError) => fieldError.message)
      .join(', ');
  }
  if (err?.name === 'CastError') {
    return `Invalid value for ${err.path}`;
  }
  return null;
};

module.exports = getValidationErrorMessage;
