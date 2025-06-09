import Mastodon from 'masto';

const fs = require('fs');
const axios = require('axios');
const mastodonSchedule = require('../models/mastodonSchedule');
const MASTODON_ENDPOINT = 'https://hgn-mastodon.com';
const ACCESS_TOKEN_FILE = "access_token.txt";

async function getMastodonAccessToken() {
    if (!fs.existsSync(ACCESS_TOKEN_FILE)) {
        throw new Error('Access token file not found');
    }
    const tokenData = fs.readFileSync(ACCESS_TOKEN_FILE, 'utf8');
    const jsonToken = JSON.parse(tokenData);

    return jsonToken;
}

// fetch access token from local file
async function fetchAccessToken() {
  const tokenObject = getMastodonAccessToken();
  return tokenObject.access_token;
}

async function getMastodonRequestHeaders() {
  const accessToken = await fetchAccessToken();
  return { Authorization: `Bearer ${accessToken}` };
}

async function getPostData(requestBody) {
    // logic for getting the request body from Mastodon needs to be written
   // Process content
   const statusId = '12345'; // logic needs to be written to make adding status ID more dynamic
   let sourceType;
   const imgType = requestBody.imgType;
   let mediaSourceItems;
   const mediaItems = requestBody.mediaItems;
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
   const description = requestBody.description
   const title = requestBody.title
 
   const postData = { status_id: statusId, description, title, media_source: mediaSource };
 
   return postData;
}

// Send post status request to Mastodon API
async function postImmediately(postData) {
  const requestUrl = `${MASTODON_ENDPOINT}/api/v1/statuses`
  return axios.post(requestUrl, postData, {
    headers: getMastodonRequestHeaders(),
    responseType: 'json'
  });
}

async function createStatus(req, res) {
  try {
    const postData = await getPostData(req.body);
    const response = await postImmediately(postData);
    res.status(200).json(response.data);
  } catch (error) {
    console.error('Error creating Mastodon status:', error.response.data);
    if (error.response) {
      res.status(error.response.status).json({ error: error.response.data.message });
    } else {
      res.status(500).json({ error: 'Failed to create Mastodon status' });
    }
  }

}

async function scheduleStatus(req, res) {
  try {
    const postDataObj = await getPostData(req.body);
    const postData = JSON.stringify(postDataObj);
    const scheduledTime = req.body.scheduledTime;
    const scheduledPin = new mastodonSchedule({ postData, scheduledTime })
    await scheduledPin.save();
    res.status(200).send();
  } catch (err) {
    res.status(500).send();
  }
}

async function fetchScheduledStatus(_req, res) {
  try {
    // TODO: add pagination
    const scheduledPinList = await mastodonSchedule.find();
    res.status(200).json(scheduledPinList);
  } catch (err) {
    res.status(500).send("Failed to fetch scheduled pins")
  }
}

async function deletedScheduledStatus(req, res) {
  try {
    await mastodonSchedule.deleteOne({ _id: req.params.id })
    res.status(200).send("Scheduled pin post deleted successfully!")
  } catch (err) {
    res.status(500).send("Failed to deleted scheduled pin post!");
  }
}

module.exports = {
  createStatus,
  scheduleStatus,
  fetchScheduledStatus,
  deletedScheduledStatus,
  postImmediately,
};