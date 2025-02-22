const axios = require('axios');
const fs = require('fs');

// const auth = `https://api.pinterest.com/oauth/?response_type=code&redirect_uri=${process.env.PINTEREST_REDIRECT_URI}&client_id=${process.env.PINTEREST_CLIENT_ID}&scope=${scopes.join(',')}`;

const OAUTH_URL = 'https://api.pinterest.com/v5/oauth';


async function getPinterestAccessToken(req, res) {
  const auth = `${process.env.PINTEREST_APP_ID}:${process.env.PINTEREST_APP_SECRET}`;
  const b64auth = Buffer.from(auth).toString('base64');
  const authHeaders = { Authorization: `Basic ${b64auth}`, 'Content-Type': 'application/x-www-form-urlencoded' };
  const scopes = ['pins:read', 'pins:write', 'boards:read', 'users:read'];
  const postData = { grant_type: 'client_credentials', scope: scopes.join(',') };

  //make a post request to Pinterest API to get access token
  try {
    console.log("getPinterestAccessToken....");
    const response = await axios.post(`${OAUTH_URL}/token`, postData, {
      headers: authHeaders,
      responseType: 'json'
    });

    console.log("response.data.......");
    console.log(response.data);
    const { access_token, expires_in } = response.data;
    const current = new Date();
    const expireTime = current.setSeconds(current.getSeconds() + expires_in)
    // Save access token to file
    const jsonToken = {
      accessToken: access_token,
      expireTime: expireTime
    }
    try {
      fs.writeFileSync('access_token.txt', JSON.stringify(jsonToken));
    }
    catch (err) {
      console.log("Error writing access token to file");
    }
    res.status(200).json({ access_token });
  } catch (error) {
    console.error('Error getting Pinterest access token:', error);
    res.status(500).json({ error: 'Failed to get Pinterest access token' });
  }
}

module.exports = {
  getPinterestAccessToken,
  createPin
};