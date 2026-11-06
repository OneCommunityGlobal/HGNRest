const SERVICE_UNAVAILABLE = 503;
const MAX_ERROR_STATUS = 599;

// Backend-only access to deployment-injected tokens. Never expose this module through a route.
class PublishingConfigurationError extends Error {
  constructor() {
    super('Social-media publishing is not configured.');
    this.name = 'PublishingConfigurationError';
  }
}

function requireToken(name) {
  const token = process.env[name];
  if (typeof token !== 'string' || !token.trim() || /[\r\n]/.test(token)) {
    throw new PublishingConfigurationError();
  }
  return token;
}

function getMastodonCredentials() {
  let endpoint;
  try {
    endpoint = new URL(process.env.MASTODON_ENDPOINT || 'https://mastodon.social');
  } catch {
    throw new PublishingConfigurationError();
  }
  if (
    endpoint.protocol !== 'https:' ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    endpoint.pathname !== '/'
  ) {
    throw new PublishingConfigurationError();
  }
  return {
    endpoint: endpoint.origin,
    headers: { Authorization: `Bearer ${requireToken('MASTODON_ACCESS_TOKEN')}` },
  };
}

function getLinkedInCredentials(expectedOrganizationUrn) {
  const organizationUrn = process.env.ORGANIZATION_URN;
  if (
    !/^urn:li:organization:\d+$/.test(organizationUrn || '') ||
    (expectedOrganizationUrn && expectedOrganizationUrn !== organizationUrn)
  ) {
    throw new PublishingConfigurationError();
  }
  return { organizationUrn, accessToken: requireToken('LINKEDIN_ACCESS_TOKEN') };
}

function publishingErrorStatus(error) {
  if (error instanceof PublishingConfigurationError) return SERVICE_UNAVAILABLE;
  const status = error?.response?.status;
  return Number.isInteger(status) && status >= 400 && status <= MAX_ERROR_STATUS ? status : 500;
}

function logPublishingError(operation, error) {
  // Provider messages, Axios config/headers and error objects can contain credentials.
  // eslint-disable-next-line no-console -- log only the fixed operation and numeric HTTP status
  console.error(operation, { status: publishingErrorStatus(error) });
}

module.exports = {
  getMastodonCredentials,
  getLinkedInCredentials,
  publishingErrorStatus,
  logPublishingError,
};
