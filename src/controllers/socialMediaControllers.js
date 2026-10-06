const fs = require('fs');
const axios = require('axios');
const pinterestSchedule = require('../models/pinterestSchedule');

const OAUTH_URL = 'https://api.pinterest.com/v5/oauth';
const ACCESS_TOKEN_FILE = 'access_token.txt';
const PINTEREST_ENDPOINT = process.env.PINTEREST_SANDBOX_API
  ? 'https://api-sandbox.pinterest.com/v5'
  : 'https://api.pinterest.com/v5';
const ONE_COMMUNITY_BOARD_NAME = 'OneCommunity';

// get access token from pinterest and store it
async function getPinterestAccessToken(authorizationCode) {
  const auth = `${process.env.PINTEREST_APP_ID}:${process.env.PINTEREST_APP_SECRET}`;
  const b64auth = Buffer.from(auth).toString('base64');

  const authHeaders = {
    Authorization: `Basic ${b64auth}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  const postData = new URLSearchParams({
    grant_type: 'authorization_code',
    code: authorizationCode,
    redirect_uri: process.env.PINTEREST_REDIRECT_URI,
  });

  const response = await axios.post(`${OAUTH_URL}/token`, postData.toString(), {
    headers: authHeaders,
  });

  const { access_token, refresh_token, expires_in } = response.data;
  const expireTime = new Date().getTime() + expires_in * 1000;

  const jsonToken = { accessToken: access_token, refreshToken: refresh_token, expireTime };
  fs.writeFileSync(ACCESS_TOKEN_FILE, JSON.stringify(jsonToken));
  return jsonToken;
}
async function refreshPinterestAccessToken() {
  const tokenData = JSON.parse(fs.readFileSync(ACCESS_TOKEN_FILE, 'utf8'));
  const auth = `${process.env.PINTEREST_APP_ID}:${process.env.PINTEREST_APP_SECRET}`;
  const b64auth = Buffer.from(auth).toString('base64');

  const postData = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: tokenData.refreshToken,
  });

  const response = await axios.post(`${OAUTH_URL}/token`, postData.toString(), {
    headers: {
      Authorization: `Basic ${b64auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  const { access_token, expires_in } = response.data;
  const expireTime = new Date().getTime() + expires_in * 1000;

  const updated = { ...tokenData, accessToken: access_token, expireTime };
  fs.writeFileSync(ACCESS_TOKEN_FILE, JSON.stringify(updated));
  return updated;
}
function getValidAccessTokenOrExcepts() {
  if (!fs.existsSync(ACCESS_TOKEN_FILE)) {
    throw new Error('Access token file not found');
  }
  const tokenData = fs.readFileSync(ACCESS_TOKEN_FILE, 'utf8');
  const tokenObject = JSON.parse(tokenData);
  const expireTime = new Date(tokenObject.expireTime);
  if (new Date() > expireTime) {
    throw new Error('Access token expired');
  }
  return tokenObject;
}

// fetch access token from local file
async function fetchAccessToken() {
  if (process.env.PINTEREST_SANDBOX_API) {
    return process.env.PINTEREST_SANDBOX_API_TOKEN;
  }

  let tokenObject;
  try {
    tokenObject = getValidAccessTokenOrExcepts();
  } catch {
    // Token missing or expired — try refresh first
    try {
      tokenObject = await refreshPinterestAccessToken();
    } catch {
      throw new Error('Pinterest token expired. Please re-authenticate via /api/pinterest/auth');
    }
  }

  return tokenObject.accessToken;
}

async function getPinterestRequestHeaders() {
  const accessToken = await fetchAccessToken();
  return { Authorization: `Bearer ${accessToken}` };
}

async function fetchBoardList() {
  const requestUrl = `${PINTEREST_ENDPOINT}/boards`;
  const response = await axios.get(requestUrl, {
    headers: await getPinterestRequestHeaders(),
    responseType: 'json',
  });
  const boardList = response.data.items;
  // console.log(boardList);
  // res.status(200).json(boardList);
  return boardList;
}
function initiatePinterestAuth(_req, res) {
  const scopes = ['pins:read', 'pins:write', 'boards:read', 'boards:write', 'users:read'];
  const authUrl = new URL('https://www.pinterest.com/oauth/');
  authUrl.searchParams.set('client_id', process.env.PINTEREST_APP_ID);
  authUrl.searchParams.set('redirect_uri', process.env.PINTEREST_REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scopes.join(','));
  res.redirect(authUrl.toString());
}

async function handlePinterestCallback(req, res) {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'No authorization code received.' });
  try {
    await getPinterestAccessToken(code);
    res.status(200).json({ message: 'Pinterest authenticated successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createBoard(title, details) {
  const requestUrl = `${PINTEREST_ENDPOINT}/boards`;
  const postData = { name: title, description: details, privacy: 'PUBLIC' };
  // const createPinHeaders = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
  const createPinHeaders = await getPinterestRequestHeaders();

  const response = await axios.post(requestUrl, postData, {
    headers: createPinHeaders,
    responseType: 'json',
  });

  return response.data;
}

async function getPostData(requestBody) {
  const boardList = await fetchBoardList();

  // If One Community board not exist, create one
  let OneCommBoard = boardList.find((board) => board.name === ONE_COMMUNITY_BOARD_NAME);
  if (!OneCommBoard) {
    const boardDetails = 'Updates from One Community';
    OneCommBoard = await createBoard(ONE_COMMUNITY_BOARD_NAME, boardDetails);
  }

  const boardId = OneCommBoard.id;

  // Process content
  let sourceType;
  const { imgType } = requestBody;
  let mediaSourceItems;
  const { mediaItems } = requestBody;
  let mediaSource;

  if (imgType === 'FILE') {
    // Process upload image file
    const contentType = mediaItems.split(';')[0].split(':')[1].trim();
    const data = mediaItems.split(',')[1].trim();

    mediaSourceItems = { content_type: contentType, data };
    sourceType = 'image_base64';
    mediaSource = { source_type: sourceType, ...mediaSourceItems };
  } else {
    // Process url image source
    mediaSourceItems = mediaItems;
    sourceType = 'image_url';
    mediaSource = { source_type: sourceType, ...mediaSourceItems };
  }
  const { description } = requestBody;
  const { title } = requestBody;

  const postData = { board_id: boardId, description, title, media_source: mediaSource };

  return postData;
}

// Send post pin request to Pinterest API
async function postPinImmediately(postData) {
  const requestUrl = `${PINTEREST_ENDPOINT}/pins`;
  return await axios.post(requestUrl, postData, {
    headers: await getPinterestRequestHeaders(),
    responseType: 'json',
  });
}

async function createPin(req, res) {
  try {
    const postData = await getPostData(req.body);
    const response = await postPinImmediately(postData);
    res.status(200).json(response.data);
  } catch (error) {
    if (error.response) {
      console.error('Error creating Pinterest pin:', error.response.data);
      res.status(error.response.status).json({ error: error.response.data.message });
    } else {
      console.error('Error creating Pinterest pin:', error.message);
      res.status(500).json({ error: error.message || 'Failed to create Pinterest pin' });
    }
  }
}

async function schedulePin(req, res) {
  try {
    const postDataObj = await getPostData(req.body);
    const postData = JSON.stringify(postDataObj);
    const { scheduledTime } = req.body;

    const scheduledPin = new pinterestSchedule({ postData, scheduledTime });
    await scheduledPin.save();
    res.status(200).send();
  } catch (err) {
    res.status(500).send();
  }
}

async function fetchScheduledPin(_req, res) {
  try {
    // TODO: add pagination
    const scheduledPinList = await pinterestSchedule.find();
    res.status(200).json(scheduledPinList);
  } catch (err) {
    res.status(500).send('Failed to fetch scheduled pins');
  }
}

async function deletedScheduledPin(req, res) {
  try {
    await pinterestSchedule.deleteOne({ _id: req.params.id });
    res.status(200).send('Scheduled pin post deleted successfully!');
  } catch (err) {
    res.status(500).send('Failed to deleted scheduled pin post!');
  }
}

module.exports = {
  createPin,
  fetchBoardList,
  createBoard,
  schedulePin,
  fetchScheduledPin,
  deletedScheduledPin,
  postPinImmediately,
  initiatePinterestAuth,
  handlePinterestCallback,
};
