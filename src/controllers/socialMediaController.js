const axios = require('axios');
const fs = require('fs');
const cheerio = require('cheerio');

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

// async function fetchBoardList(req, res) {
async function fetchBoardList() {
  let accessToken;
  let expireTime;

  if (process.env.PINTEREST_SANDBOX_API) {
    accessToken = process.env.PINTEREST_SANDBOX_API_TOKEN
  } else {
    if (!fs.existsSync("access_token.txt")) {
      console.log("no token file, start generating........")
      await getPinterestAccessToken();
    }
    let tokenData = await fs.readFileSync('access_token.txt', 'utf8');
    let tokenObject = JSON.parse(tokenData);
    expireTime = new Date(tokenObject.expireTime);
    accessToken = tokenObject.accessToken;
  }
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
  // async function createBoard(req, res){
  let accessToken = "";

  if (process.env.PINTEREST_SANDBOX_API) {
    accessToken = process.env.PINTEREST_SANDBOX_API_TOKEN
  } else {
    if (!fs.existsSync("access_token.txt")) {
      console.log("no token file, start generating........")
      await getPinterestAccessToken();
    }
    let tokenData = await fs.readFileSync('access_token.txt', 'utf8');
    let tokenObject = JSON.parse(tokenData);
    const expireTime = new Date(tokenObject.expireTime);
    accessToken = tokenObject.accessToken;
    // get new token if current token expired
    if (new Date() > expireTime) {
      await getPinterestAccessToken();
    }
    tokenData = await fs.readFileSync('access_token.txt', 'utf8');
    tokenObject = JSON.parse(tokenData);
    accessToken = tokenObject.accessToken;
  }


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



async function createPin(req, res) {
  let accessToken = "";

  if (process.env.PINTEREST_SANDBOX_API) {
    accessToken = process.env.PINTEREST_SANDBOX_API_TOKEN
  } else {
    if (!fs.existsSync("access_token.txt")) {
      console.log("no token file, start generating........")
      await getPinterestAccessToken();
    }
    let tokenData = await fs.readFileSync('access_token.txt', 'utf8');
    let tokenObject = JSON.parse(tokenData);
    const expireTime = new Date(tokenObject.expireTime);
    accessToken = tokenObject.accessToken;
    // get new token if current token expired
    if (new Date() > expireTime) {
      await getPinterestAccessToken();
    }
    tokenData = await fs.readFileSync('access_token.txt', 'utf8');
    tokenObject = JSON.parse(tokenData);
    accessToken = tokenObject.accessToken;
  }

  //get board list
  const boardList = await fetchBoardList();

  //If One Community board not exist, create one
  let OneCommBoard = boardList.find((board) => board.name === "Test");
  if (!OneCommBoard) {
    const boardTitle = "Test";
    const boardDetails = "Updates from One Community";
    OneCommBoard = await createBoard(boardTitle, boardDetails);
  }

  const board_id = OneCommBoard.id;
  console.log(OneCommBoard);
  console.log(board_id);


  //process content
  let source_type;
  const imgType = req.body.imgType;
  let media_source_items;
  // const media_source_items=req.body.mediaItems
  const mediaItems = req.body.mediaItems;
  let media_source;

  if (imgType === 'FILE') {
    //process upload image file
    //Pinterest restriction: there must be two images to use multiple_xxx source type
    media_source_items = mediaItems.map(item => {
      const content_type = item.split(';')[0].split(':')[1].trim();
      const data = item.split(',')[1].trim();
      return { content_type, data };
    })

    source_type = media_source_items.length > 1 ? 'multiple_image_base64' : 'image_base64';
    media_source = media_source_items.length > 1 ?
      { source_type, items: media_source_items } :
      { source_type, ...(media_source_items[0]) };
  } else {
    //process url image source
    //Pinterest restriction: there must be two images to use multiple_xxx source type
    media_source_items = mediaItems;
    source_type = media_source_items.length > 1 ? 'multiple_image_urls' : 'image_url';
    media_source = media_source_items.length > 1 ?
      { source_type, items: media_source_items } :
      { source_type, ...(media_source_items[0]) };
  }
  const description = req.body.description
  const title = req.body.title

  const postData = { board_id: board_id, description, title, media_source };
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
    console.error('Error creating Pinterest pin:', error.response.data);
    if (error.response) {
      res.status(error.response.status).json({ error: error.response.data.message });
    } else {
      res.status(500).json({ error: 'Failed to create Pinterest pin' });
    }
  }

}

module.exports = {
  getPinterestAccessToken,
  createPin,
  fetchBoardList,
  createBoard,
};