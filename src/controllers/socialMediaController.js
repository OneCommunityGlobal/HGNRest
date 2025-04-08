const axios = require('axios');
const fs = require('fs');
const cheerio = require('cheerio');
const uuid = require('uuid');
const pinterestSession = require('../models/pinterestSession');
const pinterestToken = require('../models/pinterestToken');

// const auth = `https://api.pinterest.com/oauth/?response_type=code&redirect_uri=${process.env.PINTEREST_REDIRECT_URI}&client_id=${process.env.PINTEREST_CLIENT_ID}&scope=${scopes.join(',')}`;

const OAUTH_URL = 'https://api.pinterest.com/v5/oauth';
const RIDRECT_URI = 'http://localhost:4500/api/social/pinterest/auth';


async function createSessionIdForOAuth(req, res) {
  const sessionId = uuid.v4();
  try {
    const newSession = new pinterestSession({
      sessionId,
      userId: req.body.requestor.requestorId,
      expireAt: new Date(Date.now() + 300000),
    });
    const savedSession = await newSession.save();
    res.status(200).json({ sessionId });
  } catch (err) {
    res.status(500).json({ error: "Fail to start session, please try again." })
  }
}

async function getSessionUserId(sessionId) {
  try {
    const { userId } = await pinterestSession.findOne({ sessionId: sessionId });
    return userId;
  } catch (err) {
    // res.status(500).json({ error: "Session not exist or expired, please try again " })
    throw new Error('SESSION_EXPIRED')
  }
}

async function deleteSession(sessionId) {
  try {
    await pinterestSession.deleteOne({ sessionId: sessionId });
  } catch (err) {
    console.log("Fail to delete session.")
  }

}

async function getPinterestAccessToken(req, res) {
  const { code, state } = req.query;
  try {
    const userId = await getSessionUserId(state);
    if (!userId) {
      // res.status(400).json({ error: 'wrong state' });
      throw new Error('WRONG_STATE')
    }
    const auth = `${process.env.PINTEREST_APP_ID}:${process.env.PINTEREST_APP_SECRET}`;
    const b64auth = Buffer.from(auth).toString('base64');
    const authHeaders = { Authorization: `Basic ${b64auth}`, 'Content-Type': 'application/x-www-form-urlencoded' };
    const scopes = ['pins:read', 'pins:write', 'boards:read', 'boards:write', 'users:read'];
    const postData = { grant_type: 'authorization_code', scope: scopes.join(','), code, redirect_uri: RIDRECT_URI, continuous_refresh: true };

    //make a post request to Pinterest API to get access token
    const response = await axios.post(`${OAUTH_URL}/token`, postData, {
      headers: authHeaders,
      responseType: 'json'
    });

    const { refresh_token, access_token, expires_in, refresh_token_expires_in } = response.data;
    console.log("refresh_token: ", refresh_token)
    const current = new Date();
    const accessTokenExpireAt = current.setSeconds(current.getSeconds() + expires_in);
    const refreshTokenExpireAt = current.setSeconds(current.getSeconds() + refresh_token_expires_in);

    //Save token to database
    const newToken = new pinterestToken({
      userId,
      accessToken: access_token,
      refreshToken: refresh_token,
      accessTokenExpireAt,
      refreshTokenExpireAt,
    })
    const savedToken = newToken.save();
    await deleteSession(code); //delete the session data after sucessfully get the token
    res.status(200);
    res.redirect('http://localhost:3000/announcements');
  } catch (err) {
    switch (err.message) {
      case 'SESSION_EXPIRED':
      case 'WRONG_STATE':
        res.status(400).json({ error: err.message });
        return;
    }
    res.status(500);
    console.log("error: fail to get access token");
    console.log(err);
  }
}

//use refresh token to obtain a new accessToken
async function refreshAccessToken(userId, refreshToken) {
  try {
    const auth = `${process.env.PINTEREST_APP_ID}:${process.env.PINTEREST_APP_SECRET}`;
    const b64auth = Buffer.from(auth).toString('base64');
    const authHeaders = { Authorization: `Basic ${b64auth}`, 'Content-Type': 'application/x-www-form-urlencoded' };
    const scopes = ['pins:read', 'pins:write', 'boards:read', 'boards:write', 'users:read'];
    const postData = { grant_type: 'refresh_token', refresh_token: refreshToken, scope: scopes.join(',') };

    //use refresh token to obtain a new access token
    const response = await axios.post(`${OAUTH_URL}/token`, postData, {
      headers: authHeaders,
      responseType: 'json'
    })

    const { refresh_token, access_token, expires_in, refresh_token_expires_in } = response.data;
    const current = new Date();
    const accessTokenExpireAt = current.setSeconds(current.getSeconds() + expires_in);
    const refreshTokenExpireAt = current.setSeconds(current.getSeconds() + refresh_token_expires_in);

    //update the new access token in database
    const updatedToken = {
      accessToken: access_token,
      refreshToken: refresh_token,
      accessTokenExpireAt,
      refreshTokenExpireAt,
    }

    await pinterestToken.findOneAndUpdate({ userId: userId, updatedToken })
  } catch (err) {

  }
}

async function createPin(req, res) {
  const userId = req.body.requestor.requestorId;
 
  try {
    const tokenObject = await pinterestToken.findOne({ userId: userId })
    const { accessToken, refreshToken, accessTokenExpireAt, refreshTokenExpireAt } = tokenObject;

    if (new Date() > refreshTokenExpireAt) {
      throw new Error('CONNECTION EXPIRED')
    }
    if (new Date() > accessTokenExpireAt) {
      await refreshAccessToken(userId, refreshToken);
    }

    let source_type;
    let hasBase64Image = false;
    let hasUrlImage = false;
    const emailContent = req.body.emailContent;
    const $ = cheerio.load(emailContent);
    let media_source;
    let media_source_items = $('img').map((i, img) => {
      const imgSrc = $(img).attr('src');
      if (imgSrc.startsWith('data:')) {
        //process base64 format image data
        hasBase64Image = true;
        // base64 format: data:image/png;base64,<base64 part>
        const content_type = imgSrc.split(';')[0].split(':')[1].trim();
        const data = imgSrc.split(',')[1].trim();
        return { content_type, data };
      } else {
        hasUrlImage = true;
        return { url: imgSrc };
      }
    }).toArray();
    if (hasBase64Image) {
      //filter base64 image source
      media_source_items = media_source_items.filter((source) => source.content_type);
      //Pinterest restriction: there must be two images to use multiple_xxx source type
      source_type = media_source_items.length > 1 ? 'multiple_image_base64' : 'image_base64';
      media_source = media_source_items.length > 1 ?
        { source_type, items: media_source_items } :
        { source_type, ...(media_source_items[0]) };
    } else {
      //filter url image source
      media_source_items = media_source_items.filter((source) => source.url);
      //Pinterest restriction: there must be two images to use multiple_xxx source type
      source_type = media_source_items.length > 1 ? 'multiple_image_urls' : 'image_url';
      media_source = media_source_items.length > 1 ?
        { source_type, items: media_source_items } :
        { source_type, ...(media_source_items[0]) };
    }
    const description = $.text();
    const board_id = '1110841133028994160'; // TODO: get board id from Pinterest API
    const title = 'Weekly progress'; // TODO: get a proper title

    const postData = { board_id: board_id, description, title, media_source };
    const createPinHeaders = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };


    let requestUrl = 'https://api.pinterest.com/v5/pins'
     
    const response = await axios.post(requestUrl, postData, {
      headers: createPinHeaders,
      responseType: 'json'
    });
    res.status(200).json(response.data);
  } catch (error) {
    console.error('Error creating Pinterest pin:', error);
    // console.error('Error creating Pinterest pin:', error.response.data);
    if (error.response) {
      res.status(error.response.status).json({ error: error.response.data.message });
    } else {
      res.status(500).json({ error: 'Failed to create Pinterest pin' });
    }
  }

}

module.exports = {
  createSessionIdForOAuth,
  getPinterestAccessToken,
  createPin
};