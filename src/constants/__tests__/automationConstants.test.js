const constants = require('../automationConstants');

describe('automationConstants', () => {
  it('should export dropboxConfig with accessToken property', () => {
    expect(constants.dropboxConfig).toBeDefined();
    expect(constants.dropboxConfig).toHaveProperty('accessToken');
  });

  it('should export sentryConfig with sentryApiToken and organizationSlug properties', () => {
    expect(constants.sentryConfig).toBeDefined();
    expect(constants.sentryConfig).toHaveProperty('sentryApiToken');
    expect(constants.sentryConfig).toHaveProperty('organizationSlug');
  });

  it('should export githubConfig with GITHUB_TOKEN and ORG_NAME properties', () => {
    expect(constants.githubConfig).toBeDefined();
    expect(constants.githubConfig).toHaveProperty('GITHUB_TOKEN');
    expect(constants.githubConfig).toHaveProperty('ORG_NAME');
  });
});
