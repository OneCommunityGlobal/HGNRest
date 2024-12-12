// eslint-disable-next-line import/no-extraneous-dependencies
const fetch = require('node-fetch');
// eslint-disable-next-line import/no-extraneous-dependencies
const cheerio = require('cheerio');

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

async function getPinterestAccessToken(req, res) {
  const authCode = req.body.code;
  const clientId = process.env.REACT_APP_PINTEREST_CLIENT_ID;
  const clientSecret = process.env.REACT_APP_PINTEREST_CLIENT_SECRET;
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
      dominant_color: '', // Hex color code
      board_id: '', // Pinterest board ID
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

module.exports = {
  getPinterestAccessToken,
  createPin,
};
