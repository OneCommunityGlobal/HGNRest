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

async function createPin(req, res) {
  let accessToken = "";

  if (process.env.PINTEREST_SANDBOX_API) {
    accessToken = process.env.PINTEREST_SANDBOX_API_TOKEN
  } else {
    if (!fs.existsSync("access_token.txt")) {
      await getPinterestAccessToken();
    }
    let tokenData = await fs.readFileSync('access_token.txt', 'utf8');
    let tokenObject = JSON.parse(tokenData);
    const expireTime = new Date(tokenObject.expireTime);
    if (new Date() > expireTime) {
      await getPinterestAccessToken();
    }
    tokenData = await fs.readFileSync('access_token.txt', 'utf8');
    tokenObject = JSON.parse(tokenData);
    accessToken = tokenObject.accessToken;
  }

  const { board_id, title, description, media_source } = req.body;
  const postData = { board_id: board_id, description: description, title: title, media_source: media_source };
  const createPinHeaders = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

  try {
    let requestUrl = ""
    if (process.env.PINTEREST_SANDBOX_API) {
      requestUrl = 'https://api-sandbox.pinterest.com/v5/pins'
    } else {
      requestUrl = 'https://api.pinterest.com/v5/pins'
    }
    // const response = await axios.post('https://api.pinterest.com/v5/pins', postData, {
    const response = await axios.post(requestUrl, postData, {
      headers: createPinHeaders,
      responseType: 'json'
    });
    res.status(200).json(response.data);
  } catch (error) {
    console.error('Error creating Pinterest pin:', error);
    res.status(500).json({ error: 'Failed to create Pinterest pin' });
  }

}

module.exports = {
  getPinterestAccessToken,
  createPin
};