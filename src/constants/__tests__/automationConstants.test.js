const automationConstants = require('../automationConstants');

describe('automationConstants', () => {
  describe('dropboxConfig', () => {
    it('should export dropboxConfig object', () => {
      expect(automationConstants.dropboxConfig).toBeDefined();
      expect(typeof automationConstants.dropboxConfig).toBe('object');
    });

    it('should have accessToken property', () => {
      expect(automationConstants.dropboxConfig).toHaveProperty('accessToken');
    });
  });

  describe('sentryConfig', () => {
    it('should export sentryConfig object', () => {
      expect(automationConstants.sentryConfig).toBeDefined();
      expect(typeof automationConstants.sentryConfig).toBe('object');
    });

    it('should have sentryApiToken property', () => {
      expect(automationConstants.sentryConfig).toHaveProperty('sentryApiToken');
    });

    it('should have organizationSlug property', () => {
      expect(automationConstants.sentryConfig).toHaveProperty('organizationSlug');
    });
  });

  describe('githubConfig', () => {
    it('should export githubConfig object', () => {
      expect(automationConstants.githubConfig).toBeDefined();
      expect(typeof automationConstants.githubConfig).toBe('object');
    });

    it('should have GITHUB_TOKEN property', () => {
      expect(automationConstants.githubConfig).toHaveProperty('GITHUB_TOKEN');
    });

    it('should have ORG_NAME property', () => {
      expect(automationConstants.githubConfig).toHaveProperty('ORG_NAME');
    });
  });
});
