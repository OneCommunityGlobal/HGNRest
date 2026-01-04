const { BitwardenClient, DeviceType } = require('@bitwarden/sdk-napi');
const { LogLevel } = require('@bitwarden/sdk-napi/binding');

const bitwardenController = () => {
  const authenticate = async (req, res) => {
    try {
      const settings = {
        apiUrl: 'https://api.bitwarden.com',
        identityUrl: 'https://identity.bitwarden.com',
        deviceType: DeviceType.SDK,
      };

      const accessToken = process.env.BWS_ACCESS_TOKEN;
      const organizationId = process.env.BITWARDEN_ORGANIZATION_ID;

      if (!accessToken || !organizationId) {
        return res.status(400).json({
          success: false,
          message: 'Missing access token or organization ID',
        });
      }

      const client = new BitwardenClient(settings, LogLevel.Info);
      await client.auth().loginAccessToken(accessToken);

      const secrets = await client.secrets().list(organizationId);

      // const specificSecret = await client.secrets().get(secretId);

      if (secrets.data) {
        return res.status(200).json({
          success: true,
          message: `Retrieved secrets from Bitwarden`,
        });
      }

      return res.status(404).json({
        success: false,
        message: 'Failed to connect with access token',
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed testig endpoint',
      });
    }
  };

  return {
    authenticate,
  };
};

module.exports = bitwardenController;
