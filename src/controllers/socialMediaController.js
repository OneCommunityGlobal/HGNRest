const fetch = require('node-fetch');
const cheerio = require('cheerio');
const { TwitterApi } = require('twitter-api-v2');
const ScheduledPost = require('../models/scheduledPostSchema');

function extractTextAndImgUrl(htmlString) {
  const $ = cheerio.load(htmlString);
  const textContent = $.root().text().replace(/\s+/g, ' ').trim();
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

async function postToTwitter(content, image) {
  const TwitterClient = new TwitterApi({
    appKey: process.env.REACT_APP_TWITTER_APP_KEY,
    appSecret: process.env.REACT_APP_TWITTER_APP_SECRET,
    accessToken: process.env.REACT_APP_TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.REACT_APP_TWITTER_ACCESS_SECRET,
  });

  const rwClient = TwitterClient.readWrite;
  const textContent = content;
  const base64Srcs = image;

  try {
    let mediaIds = [];
    // src type is base64
    if (base64Srcs && base64Srcs.length > 0) {
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
    }

    const tweetOptions = { text: textContent };

    if (mediaIds && mediaIds.length > 0) {
      tweetOptions.media = { media_ids: mediaIds };
    }

    const tweet = await rwClient.v2.tweet(tweetOptions);
  } catch (error) {
    console.error('[Backend] Network or other error: ', error);
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
      .loginWithOAuth2({ code, codeVerifier, redirectUri: 'http://localhost:4500/announcements' })
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

async function scheduleTweet(req, res) {
  const { textContent, urlSrcs, base64Srcs } = extractTextAndImgUrl(req.body.EmailContent);
  const scheduledDate = req.body.ScheduleDate;
  const scheduledTime = req.body.ScheduleTime;
  if (!scheduledDate || !scheduledTime) {
    return res
      .status(400)
      .json({ error: 'Missing required parameters: scheduledDate or scheduledTime' });
  }
  const platform = 'twitter';
  const newScheduledTweet = new ScheduledPost({
    textContent,
    urlSrcs,
    base64Srcs,
    scheduledDate,
    scheduledTime,
    platform,
    status: 'scheduled',
  });

  newScheduledTweet
    .save()
    .then((scheduledTweet) => {
      res.status(200).json({ success: true, scheduledTweet });
    })
    .catch((error) => {
      console.error('[Backend] Database error: ', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    });
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
    }

    // src type is base64
    if (base64Srcs && base64Srcs.length > 0) {
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

    const newTweet = new ScheduledPost({
      textContent,
      urlSrcs,
      base64Srcs,
      scheduledDate: new Date().toLocaleDateString(),
      scheduledTime: new Date().toLocaleTimeString(),
      platform: 'twitter',
      status: 'posted',
    });

    await newTweet.save();

    res.status(200).json({ success: true, tweet });
  } catch (error) {
    console.error('[Backend] Network or other error: ', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

async function getPosts(req, res) {
  try {
    const posts = await ScheduledPost.find({}).select(
      'textContent urlSrcs scheduledDate scheduledTime platform createdAt base64Srcs',
    );
    res.status(200).json({ success: true, posts });
  } catch (error) {
    console.error('[Backend] Database error: ', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

async function deletePosts(req, res) {
  const { _id } = req.body;

  if (!_id) {
    return res.status(400).json({ error: 'Missing required parameter: postId' });
  }

  try {
    const deletedPost = await ScheduledPost.findOneAndDelete({ _id });

    if (!deletedPost) {
      return res.status(404).json({ error: 'Post not found or already deleted' });
    }

    res.status(200).json({ success: true, message: 'Post deleted successfully' });
  } catch (error) {
    console.error('[Backend] Database error: ', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

async function updatePosts(req, res) {
  const { _id, textContent, urlSrcs, scheduledDate, scheduledTime, platform } = req.body;
  if (!_id) {
    return res.status(400).json({ error: 'Missing required parameter: _id' });
  }
  try {
    const updatedPost = await ScheduledPost.findOneAndUpdate(
      { _id },
      { textContent, urlSrcs, scheduledDate, scheduledTime, platform },
      { new: true },
    );
    if (!updatedPost) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.status(200).json({ success: true, updatedPost });
  } catch (error) {
    console.error('[Backend] Database error: ', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

module.exports = {
  getTwitterAccessToken,
  createTweet,
  scheduleTweet,
  postToTwitter,
  getPosts,
  deletePosts,
  updatePosts,
};
