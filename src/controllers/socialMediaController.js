// eslint-disable-next-line import/no-extraneous-dependencies
const fetch = require('node-fetch');
// eslint-disable-next-line import/no-extraneous-dependencies
const cheerio = require('cheerio');
// eslint-disable-next-line import/no-extraneous-dependencies
const { TwitterApi } = require('twitter-api-v2');

const TwitterClient = new TwitterApi({
  appKey: process.env.REACT_APP_TWITTER_APP_KEY,
  appSecret: process.env.REACT_APP_TWITTER_APP_SECRET,
  accessToken: process.env.REACT_APP_TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.REACT_APP_TWITTER_ACCESS_SECRET,
});

// const TwitterClient = new TwitterApi(process.env.REACT_APP_TWITTER_TOKEN);

function extractTextAndImgUrl(htmlString) {
  const $ = cheerio.load(htmlString);

  const textContent = $('body').text().replace(/\+/g, '').trim();

  const imgSrcs = $('img')
    .map((i, img) => $(img).attr('src'))
    .get();

  return { textContent, imgSrcs };
}

async function getPinterestAccessToken(req, res) {
  const authCode = req.body.code;
  const clientId = '1503261';
  const clientSecret = '2644a99853f263bd5688935762a32135293b950b';
  const accessTokenUrl = 'https://api-sandbox.pinterest.com/v5/oauth/token';

  const authToken = btoa(`${clientId}:${clientSecret}`);

  const requestBody = new URLSearchParams();
  requestBody.append('grant_type', 'authorization_code');
  requestBody.append('code', authCode);
  requestBody.append('redirect_uri', 'http://localhost:3000');

  try {
    console.log('try to fetch');
    const response = await fetch(accessTokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: requestBody.toString(),
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('backend error: ', error);
  }
}

// TODO: IF scr is link?
async function createPin(req, res) {
  const requestUrl = 'https://api-sandbox.pinterest.com/v5/pins';
  const authToken = req.body.Authorization;
  const { textContent, imgSrcs } = extractTextAndImgUrl(req.body.EmailContent);

  if (imgSrcs.length === 0) {
    return res.status(400).json({ message: 'No image found in the email content' });
  }

  try {
    const baseRequestBody = {
      title: 'Weekly Update',
      description: textContent,
      dominant_color: '#6E7874',
      board_id: '1074812336009724062',
    };

    const mediaSource =
      imgSrcs.length === 1
        ? {
            source_type: 'image_base64',
            content_type: 'image/jpeg',
            data: imgSrcs[0].replace(/^data:image\/\w+;base64,/, ''),
          }
        : {
            source_type: 'multiple_image_base64',
            items: imgSrcs.map((imgSrc) => ({
              content_type: 'image/jpeg',
              data: imgSrc.replace(/^data:image\/\w+;base64,/, ''),
            })),
          };

    const requestBody = JSON.stringify({
      ...baseRequestBody,
      media_source: mediaSource,
    });

    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        Authorization: authToken,
        'Content-Type': 'application/json',
      },
      body: requestBody,
    });

    const statusCode = response.status;
    const responseData = await response.json();

    if (statusCode >= 200 && statusCode < 300) {
      res.status(200).json(responseData);
    } else {
      console.error('[Backend] Error creating Pin: ', responseData.message);
      res.status(statusCode).json({
        message: responseData.message || 'Unexpected error',
      });
    }
  } catch (error) {
    console.error('[Backend] Network or other error: ', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

async function createTweet(req, res) {
  const rwClient = TwitterClient.readWrite;
  const { textContent, imgSrcs } = extractTextAndImgUrl(req.body.EmailContent);

  try {
    let mediaIds = [];
    if (imgSrcs && imgSrcs.length > 0) {
      console.log('Uploading media...');
      mediaIds = await Promise.all(
        imgSrcs.map(async (imgSrc) => {
          const base64Data = imgSrc.replace(/^data:image\/\w+;base64,/, '');
          const buffer = Buffer.from(base64Data, 'base64');
          const mimeType = 'image/png';
          return rwClient.v1.uploadMedia(buffer, { mimeType });
        }),
      );
      console.log('Media uploaded, IDs:', mediaIds);
    }

    const tweet = await rwClient.v2.tweet({
      text: textContent,
      media: { media_ids: mediaIds },
    });

    res.status(200).json({ success: true, tweet });
  } catch (error) {
    console.error('[Backend] Network or other error: ', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

module.exports = {
  getPinterestAccessToken,
  createPin,
  createTweet,
};
