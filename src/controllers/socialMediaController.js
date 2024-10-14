// eslint-disable-next-line import/no-extraneous-dependencies
const fetch = require('node-fetch');
// eslint-disable-next-line import/no-extraneous-dependencies
const cheerio = require('cheerio');
// eslint-disable-next-line import/no-extraneous-dependencies
const { TwitterApi } = require('twitter-api-v2');

function extractTextAndImgUrl(htmlString) {
  const $ = cheerio.load(htmlString);

  const textContent = $('body').text().replace(/\+/g, '').trim();
  const urlSrcs = [];
  const base64Srcs = [];

  $('img').each((i, img) => {
    const src = $(img).attr('src');
    if (src) {
      if (src.startsWith('data:image')) {
        base64Srcs.push(src);
      } else {
        urlSrcs.push(src);
      }
    }
  });

  return { textContent, urlSrcs, base64Srcs };
}

async function downloadImage(url) {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType: response.headers.get('content-type'),
  };
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

async function getTwitterAccessToken(req, res) {
  const twitterOAuth = new TwitterApi({
    clientId: process.env.REACT_APP_TWITTER_CLIENT_ID,
    clientSecret: process.env.REACT_APP_TWITTER_CLIENT_SECRET,
  });

  const { code, state, codeVerifier } = req.body;

  if (!code || !state || !codeVerifier) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    twitterOAuth
      .loginWithOAuth2({ code, codeVerifier, redirectUri: 'http://localhost:3000/announcements' })
      .then(async ({ client: loggedClient, accessToken, expiresIn, scope }) => {
        try {
          const { data } = await loggedClient.v2.me();
          console.log('User data:', data);
          console.log('scope:', scope);
          res.json({
            access_token: accessToken,
            expires_in: expiresIn,
          });
        } catch (error) {
          console.error('API Error:', error);
        }
      });
  } catch (error) {
    console.error('Error exchanging code for token:', error);
    res.status(500).json({ error: 'Failed to obtain access token' });
  }
}
// TODO: IF scr is link?
async function createPin(req, res) {
  const requestUrl = 'https://api-sandbox.pinterest.com/v5/pins';
  const authToken = req.body.Authorization;
  const { textContent, urlSrcs, base64Srcs } = extractTextAndImgUrl(req.body.EmailContent);

  if (urlSrcs.length === 0 && base64Srcs.length === 0) {
    return res.status(400).json({ message: 'No image found in the email content' });
  }

  if (urlSrcs.length > 0 && base64Srcs.length > 0) {
    return res.status(400).json({
      message:
        'Both URL and base64 images found in the email content. Please choose only one type.',
    });
  }

  try {
    const baseRequestBody = {
      title: 'Weekly Update',
      description: textContent,
      dominant_color: '#6E7874',
      board_id: '1074812336009724062',
    };

    let mediaSource = {};

    if (base64Srcs.length !== 0) {
      mediaSource =
        base64Srcs.length === 1
          ? {
              source_type: 'image_base64',
              content_type: base64Srcs[0].split(';')[0].split(':')[1] || 'image/png',
              data: base64Srcs[0].replace(/^data:image\/\w+;base64,/, ''),
            }
          : {
              source_type: 'multiple_image_base64',
              items: base64Srcs.map((imgSrc) => ({
                content_type: imgSrc.split(';')[0].split(':')[1] || 'image/png',
                data: imgSrc.replace(/^data:image\/\w+;base64,/, ''),
              })),
            };
    }

    if (urlSrcs.length !== 0) {
      mediaSource =
        urlSrcs.length === 1
          ? {
              source_type: 'image_url',
              url: urlSrcs[0],
            }
          : {
              source_type: 'multiple_image_urls',
              items: urlSrcs.map((url) => ({ url })),
            };
    }

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
  const TwitterClient = new TwitterApi({
    appKey: process.env.REACT_APP_TWITTER_APP_KEY,
    appSecret: process.env.REACT_APP_TWITTER_APP_SECRET,
    accessToken: process.env.REACT_APP_TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.REACT_APP_TWITTER_ACCESS_SECRET,
  });

  const rwClient = TwitterClient.readWrite;
  const { textContent, urlSrcs, base64Srcs } = extractTextAndImgUrl(req.body.EmailContent);

  try {
    let mediaIds = [];
    // src type is url
    if (urlSrcs && urlSrcs.length > 0) {
      console.log('Uploading URL media...');
      const urlMediaIds = await Promise.all(
        urlSrcs.map(async (imageUrl) => {
          try {
            const { buffer, mimeType } = await downloadImage(imageUrl);
            return await rwClient.v1.uploadMedia(buffer, { mimeType });
          } catch (error) {
            console.error(`Error uploading URL image: ${imageUrl}`, error);
            return null;
          }
        }),
      );
      mediaIds = mediaIds.concat(urlMediaIds.filter((id) => id !== null));
      console.log('URL media uploaded, IDs:', mediaIds);
    }

    // src type is base64
    if (base64Srcs && base64Srcs.length > 0) {
      console.log('Uploading base64 media...');
      const base64MediaIds = await Promise.all(
        base64Srcs.map(async (imgSrc) => {
          try {
            const base64Data = imgSrc.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            const mimeType = imgSrc.split(';')[0].split(':')[1] || 'image/png';
            return await rwClient.v1.uploadMedia(buffer, { mimeType });
          } catch (error) {
            console.error('Error uploading base64 image', error);
            return null;
          }
        }),
      );
      mediaIds = mediaIds.concat(base64MediaIds.filter((id) => id !== null));
      console.log('Base64 media uploaded, IDs:', mediaIds);
    }

    const tweetOptions = { text: textContent };

    if (mediaIds && mediaIds.length > 0) {
      tweetOptions.media = { media_ids: mediaIds };
    }

    const tweet = await rwClient.v2.tweet(tweetOptions);

    res.status(200).json({ success: true, tweet });
  } catch (error) {
    console.error('[Backend] Network or other error: ', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

module.exports = {
  getPinterestAccessToken,
  getTwitterAccessToken,
  createPin,
  createTweet,
};
