// Set test timeout
jest.setTimeout(30000);

// Mock environment variables
process.env.GITHUB_TOKEN = 'test-github-token';
process.env.SENTRY_API_TOKEN = 'test-sentry-token';
process.env.DROPBOX_ACCESS_TOKEN = 'test-dropbox-token';
process.env.SLACK_WORKSPACE_URL = 'https://test.slack.com';
process.env.GOOGLE_SERVICE_ACCOUNT_KEY = JSON.stringify({
  type: 'service_account',
  project_id: 'test-project',
  private_key_id: 'test-key-id',
  private_key: 'test-private-key',
  client_email: 'test@test-project.iam.gserviceaccount.com',
  client_id: 'test-client-id'
});
process.env.GOOGLE_SHEET_ID = 'test-sheet-id';
process.env.ORG_NAME = 'test-org';
process.env.SENTRY_ORG_SLUG = 'test-org-slug';

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Promise Rejection:', error);
}); 