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

      const secretValues = await Promise.all(
        secrets.data.map(({ id }) => client.secrets().get(id)),
      );

      if (secrets.data) {
        return res.status(200).json({
          success: true,
          message: `Retrieved secrets from Bitwarden`,
          data: secretValues,
        });
      }

      return res.status(404).json({
        success: false,
        message: 'Failed to connect with access token',
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed Bitwarden authentication',
      });
    }
  };

  return {
    authenticate,
  };
};

module.exports = bitwardenController;
