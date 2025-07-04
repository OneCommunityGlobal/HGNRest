module.exports.dropboxConfig = {
  accessToken: process.env.DROPBOX_ACCESS_TOKEN, // Store the access token in .env for security
};

module.exports.sentryConfig = {
  sentryApiToken: process.env.SENTRY_API_TOKEN, // Store the Sentry API token in .env
  organizationSlug: process.env.SENTRY_ORG_SLUG, // Store the organization slug in .env
};

module.exports.githubConfig = {
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,  // Store GitHub token securely in .env
  ORG_NAME: process.env.ORG_NAME,          // Store GitHub organization name
};