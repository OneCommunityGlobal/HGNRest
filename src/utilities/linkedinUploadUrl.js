// Only these upload endpoints are documented for the LinkedIn Assets integration.
// Never forward the provider response's origin, even after validating it.
const linkedinUploadUrl = (uploadUrl) => {
  if (typeof uploadUrl !== 'string' || /[\\\s]/.test(uploadUrl)) {
    throw new Error('Received an invalid LinkedIn upload URL');
  }
  const parsed = new URL(uploadUrl);
  if (parsed.username || parsed.password || parsed.hash) {
    throw new Error('Received an invalid LinkedIn upload URL');
  }

  if (
    parsed.origin === 'https://www.linkedin.com' &&
    /^\/dms-uploads\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(parsed.pathname)
  ) {
    return `https://www.linkedin.com${parsed.pathname}${parsed.search}`;
  }
  if (
    parsed.origin === 'https://api.linkedin.com' &&
    /^\/mediaUpload\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(parsed.pathname)
  ) {
    return `https://api.linkedin.com${parsed.pathname}${parsed.search}`;
  }
  throw new Error('Received an invalid LinkedIn upload URL');
};

module.exports = linkedinUploadUrl;
