const { execSync } = require('child_process');

const bitwardenPasswordController = () => {
  const vaultItemRetrival = async (req, res) => {
    if (!process.env.BW_CLIENTID || !process.env.BW_CLIENTSECRET) {
      return res.status(500).json({
        success: false,
        message: 'BW_CLIENTID and BW_CLIENTSECRET environment variables must be set.',
      });
    }

    try {
      execSync('bw login --apikey');

      const sessionKey = execSync('bw unlock --raw --passwordenv BW_PASSWORD', {
        encoding: 'utf-8',
      }).trim();
      if (!sessionKey) {
        return res.status(400).json({
          success: false,
          message: 'Bitwarden unlock failed: No session key returned.',
        });
      }

      let searchValue = '';
      const { search } = req.query;
      if (search) searchValue = `--search ${search}`;

      const output = execSync(`bw list items ${searchValue} --session ${sessionKey}`, {
        encoding: 'utf-8',
      });
      const vaultItems = JSON.parse(output);

      execSync('bw logout');

      const loginDetails = vaultItems
        .filter((item) => item.type === 1 && item.login)
        .map((item) => ({
          name: item.name,
          ...(item.login.username && { username: item.login.username }),
          ...(item.login.password && { password: item.login.password }),
        }));

      return res.status(200).json({
        success: true,
        vaultItems,
        loginDetails,
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  };

  return {
    vaultItemRetrival,
  };
};

module.exports = bitwardenPasswordController;
