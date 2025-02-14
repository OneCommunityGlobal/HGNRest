const axios = require('axios');

// const auth = `https://api.pinterest.com/oauth/?response_type=code&redirect_uri=${process.env.PINTEREST_REDIRECT_URI}&client_id=${process.env.PINTEREST_CLIENT_ID}&scope=${scopes.join(',')}`;

const OAUTH_URL = 'https://api.pinterest.com/v5/oauth';


async function getPinterestAccessToken(req, res) {
  const auth = `${process.env.PINTEREST_APP_ID}:${process.env.PINTEREST_APP_SECRET}`;
  const b64auth = Buffer.from(auth).toString('base64');
  const auth_headers = { Authorization: `Basic ${b64auth}`, 'Content-Type': 'application/x-www-form-urlencoded' };
  const scopes = ['pins:read', 'pins:write', 'boards:read', 'users:read'];
  const post_data = { grant_type: 'client_credentials', scope: scopes.join(',') };
  try {
    console.log("getPinterestAccessToken....");
    const response = await axios.post(`${OAUTH_URL}/token`, post_data, {
      headers: auth_headers,
      responseType: 'json'
    });

    const { access_token } = response.data;

    res.status(200).json({ access_token });
  } catch (error) {
    console.error('Error getting Pinterest access token:', error);
    res.status(500).json({ error: 'Failed to get Pinterest access token' });
  }
}

async function createPin(req, res) {

}

module.exports = {
  getPinterestAccessToken,
  createPin
};