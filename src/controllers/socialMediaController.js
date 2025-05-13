const axios = require('axios');
const fs = require('fs');
const pinterestSchedule = require('../models/pinterestSchedule');
const OAUTH_URL = 'https://api.pinterest.com/v5/oauth';


//get access token from pinterest and store it
async function getPinterestAccessToken(req, res) {
  const auth = `${process.env.PINTEREST_APP_ID}:${process.env.PINTEREST_APP_SECRET}`;
  const b64auth = Buffer.from(auth).toString('base64');
  const authHeaders = { Authorization: `Basic ${b64auth}`, 'Content-Type': 'application/x-www-form-urlencoded' };
  const scopes = ['pins:read', 'pins:write', 'boards:read', 'users:read'];
  const postData = { grant_type: 'client_credentials', scope: scopes.join(',') };

  //make a post request to Pinterest API to get access token
  try {
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
    try {
      fs.writeFileSync('access_token.txt', JSON.stringify(jsonToken));
    }
    catch (err) {
      console.error("Error writing access token to file");
    }
    res.status(200).json({ access_token });
  } catch (error) {
    console.error('Error getting Pinterest access token:', error);
    res.status(500).json({ error: 'Failed to get Pinterest access token' });
  }
}

//fetch access token from local file
async function fetchAccessToken() {
  let accessToken = "";
  if (process.env.PINTEREST_SANDBOX_API) {
    return process.env.PINTEREST_SANDBOX_API_TOKEN;
  }

  if (!fs.existsSync("access_token.txt")) {
    console.log("no token file, start generating........")
    await getPinterestAccessToken();
  }
  let tokenData = fs.readFileSync('access_token.txt', 'utf8');
  let tokenObject = JSON.parse(tokenData);
  const expireTime = new Date(tokenObject.expireTime);
  accessToken = tokenObject.accessToken;
  // get new token if current token expired
  if (new Date() > expireTime) {
    await getPinterestAccessToken();
  }
  tokenData = fs.readFileSync('access_token.txt', 'utf8');
  tokenObject = JSON.parse(tokenData);
  accessToken = tokenObject.accessToken;
  return accessToken;
}


async function fetchBoardList() {
  const accessToken = await fetchAccessToken();
  const requestHeader = { Authorization: `Bearer ${accessToken}` }

  try {
    let requestUrl = ""
    if (process.env.PINTEREST_SANDBOX_API) {
      requestUrl = 'https://api-sandbox.pinterest.com/v5/boards'
    } else {
      requestUrl = 'https://api.pinterest.com/v5/boards'
    }
    const response = await axios.get(requestUrl, {
      headers: requestHeader,
      responseType: 'json'
    });
    const boardList = response.data.items;
    // console.log(boardList);
    // res.status(200).json(boardList);
    return boardList;
  } catch (error) {
    console.error('Error getting board list:', error);
    if (error.response) {
      // res.status(error.response.status).json({ error: error.response.data.message });
      console.log(error.response.data.message);
    } else {
      // res.status(500).json({ error: 'Failed to get board list' });
      console.log('Failed to get board list');
    }
  }
}

async function createBoard(title, details) {
  const accessToken = await fetchAccessToken();
  try {
    let requestUrl = ""
    if (process.env.PINTEREST_SANDBOX_API) {
      requestUrl = 'https://api-sandbox.pinterest.com/v5/boards'
    } else {
      requestUrl = 'https://api.pinterest.com/v5/boards'
    }

    const postData = { name: title, description: details, privacy: "PUBLIC" };
    const createPinHeaders = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

    const response = await axios.post(requestUrl, postData, {
      headers: createPinHeaders,
      responseType: 'json'
    })

    return response.data;
    // res.status(200).json(response.data)
  } catch (error) {
    console.error('Error creating board:', error);
    if (error.response) {
      // res.status(error.response.status).json({ error: error.response.data.message });
      rconsole.log(error.response.data.message);
    } else {
      // res.status(500).json({ error: 'Failed to create board' });
      console.log('Failed to create board');
    }
  }
}


async function getPostData(requestBody) {
  const boardList = await fetchBoardList();

  //If One Community board not exist, create one
  let OneCommBoard = boardList.find((board) => board.name === "Test");
  if (!OneCommBoard) {
    const boardTitle = "Test";
    const boardDetails = "Updates from One Community";
    OneCommBoard = await createBoard(boardTitle, boardDetails);
  }

  const board_id = OneCommBoard.id;
  
  //Process content
  let source_type;
  const imgType = requestBody.imgType;
  let media_source_items;
  const mediaItems = requestBody.mediaItems;
  let media_source;

  if (imgType === 'FILE') {
    //Process upload image file
    const content_type = mediaItems.split(';')[0].split(':')[1].trim();
    const data = mediaItems.split(',')[1].trim();

    media_source_items = { content_type, data };
    source_type = 'image_base64';
    media_source = { source_type, ...media_source_items };
  } else {
    //Process url image source
    media_source_items = mediaItems;
    source_type = 'image_url';
    media_source = { source_type, ...media_source_items };
  }
  const description = requestBody.description
  const title = requestBody.title

  const postData = { board_id: board_id, description, title, media_source };

  return postData;

}

//Send post pin request to Pinterest API
async function postPinImmediately(postData) {
  const accessToken = await fetchAccessToken();
  const createPinHeaders = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

  try {
    let requestUrl = ""
    if (process.env.PINTEREST_SANDBOX_API) {
      requestUrl = 'https://api-sandbox.pinterest.com/v5/pins'
    } else {
      requestUrl = 'https://api.pinterest.com/v5/pins'
    }
    const response = await axios.post(requestUrl, postData, {
      headers: createPinHeaders,
      responseType: 'json'
    });
    return response;
  } catch (error) {
    console.error('Error creating Pinterest pin:', error.response.data);
  }


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

async function fetchScheduledPin(req, res) {
  try {
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
  getPinterestAccessToken,
  createPin,
  fetchBoardList,
  createBoard,
  schedulePin,
  fetchScheduledPin,
  deletedScheduledPin,
  postPinImmediately,
};