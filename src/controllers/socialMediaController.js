const axios = require('axios');
const fs = require('fs');
const pinterestSchedule = require('../models/pinterestSchedule');
const OAUTH_URL = 'https://api.pinterest.com/v5/oauth';
const ACCESS_TOKEN_FILE = "access_token.txt";
const PINTEREST_ENDPOINT = process.env.PINTEREST_SANDBOX_API ? 'https://api-sandbox.pinterest.com/v5' : 'https://api.pinterest.com/v5';
const ONE_COMMUNITY_BOARD_NAME = "OneCommunity";

//get access token from pinterest and store it
async function getPinterestAccessToken() {
  const auth = `${process.env.PINTEREST_APP_ID}:${process.env.PINTEREST_APP_SECRET}`;
  const b64auth = Buffer.from(auth).toString('base64');
  const authHeaders = { Authorization: `Basic ${b64auth}`, 'Content-Type': 'application/x-www-form-urlencoded' };
  const scopes = ['pins:read', 'pins:write', 'boards:read', 'users:read'];
  const postData = { grant_type: 'client_credentials', scope: scopes.join(',') };

  //make a post request to Pinterest API to get access token
  const response = await axios.post(`${OAUTH_URL}/token`, postData, {
    headers: authHeaders,
    responseType: 'json'
  });

  const { access_token, expires_in } = response.data;
  const current = new Date();
  const expireTime = current.setSeconds(current.getSeconds() + expires_in)
  // Save access token to file
  const jsonToken = {
    accessToken: access_token,
    expireTime: expireTime
  }
  fs.writeFileSync(ACCESS_TOKEN_FILE, JSON.stringify(jsonToken));
  return jsonToken;
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

//fetch access token from local file
async function fetchAccessToken() {
  if (process.env.PINTEREST_SANDBOX_API) {
    return process.env.PINTEREST_SANDBOX_API_TOKEN;
  }

  let tokenObject;
  try {
    tokenObject = getValidAccessTokenOrExcepts();
  } catch (error) {
    // No valid access token is found, getting a new one
    tokenObject = await getPinterestAccessToken();
  }

  return tokenObject.accessToken;
}

async function getPinterestRequestHeaders() {
  const accessToken = await fetchAccessToken();
  return { Authorization: `Bearer ${accessToken}` }
}

async function fetchBoardList() {
  const requestUrl = `${PINTEREST_ENDPOINT}/boards`;
  const response = await axios.get(requestUrl, {
    headers: await getPinterestRequestHeaders(),
    responseType: 'json'
  });
  const boardList = response.data.items;
  // console.log(boardList);
  // res.status(200).json(boardList);
  return boardList;
}


async function createBoard(title, details) {
  const requestUrl = `${PINTEREST_ENDPOINT}/boards`
  const postData = { name: title, description: details, privacy: "PUBLIC" };
  // const createPinHeaders = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
  const createPinHeaders = await getPinterestRequestHeaders();

  const response = await axios.post(requestUrl, postData, {
    headers: createPinHeaders,
    responseType: 'json'
  })

  return response.data;
}

async function getPostData(requestBody) {
  const boardList = await fetchBoardList();

  //If One Community board not exist, create one
  let OneCommBoard = boardList.find((board) => board.name === ONE_COMMUNITY_BOARD_NAME);
  if (!OneCommBoard) {
    const boardDetails = "Updates from One Community";
    OneCommBoard = await createBoard(ONE_COMMUNITY_BOARD_NAME, boardDetails);
  }

  const boardId = OneCommBoard.id;

  //Process content
  let sourceType;
  const imgType = requestBody.imgType;
  let mediaSourceItems;
  const mediaItems = requestBody.mediaItems;
  let mediaSource;

  if (imgType === 'FILE') {
    //Process upload image file
    const contentType = mediaItems.split(';')[0].split(':')[1].trim();
    const data = mediaItems.split(',')[1].trim();

    mediaSourceItems = { content_type: contentType, data };
    sourceType = 'image_base64';
    mediaSource = { source_type: sourceType, ...mediaSourceItems };
  } else {
    //Process url image source
    mediaSourceItems = mediaItems;
    sourceType = 'image_url';
    mediaSource = { source_type: sourceType, ...mediaSourceItems };
  }
  const description = requestBody.description
  const title = requestBody.title

  const postData = { board_id: boardId, description, title, media_source: mediaSource };

  return postData;

}

//Send post pin request to Pinterest API
async function postPinImmediately(postData) {
  const requestUrl = `${PINTEREST_ENDPOINT}/pins`
  return await axios.post(requestUrl, postData, {
    headers: await getPinterestRequestHeaders(),
    responseType: 'json'
  });
}

async function createPin(req, res) {
  try {
    const postData = await getPostData(req.body);
    const response = await postPinImmediately(postData);
    res.status(200).json(response.data);
  } catch (error) {
    console.error('Error creating Pinterest pin:', error.response.data);
    if (error.response) {
      res.status(error.response.status).json({ error: error.response.data.message });
    } else {
      res.status(500).json({ error: 'Failed to create Pinterest pin' });
    }
  }

}

async function schedulePin(req, res) {
  try {
    const postDataObj = await getPostData(req.body);
    const postData = JSON.stringify(postDataObj);
    const scheduledTime = req.body.scheduledTime;

    const scheduledPin = new pinterestSchedule({ postData, scheduledTime })
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
    res.status(500).send("Failed to fetch scheduled pins")
  }
}

async function deletedScheduledPin(req, res) {
  try {
    await pinterestSchedule.deleteOne({ _id: req.params.id })
    res.status(200).send("Scheduled pin post deleted successfully!")
  } catch (err) {
    res.status(500).send("Failed to deleted scheduled pin post!");
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
};