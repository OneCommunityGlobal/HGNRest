// eslint-disable-next-line import/no-extraneous-dependencies
const fetch = require('node-fetch');
// eslint-disable-next-line import/no-extraneous-dependencies
const cheerio = require('cheerio');
const MediumPost = require('../models/mediumPost');

function extractTextAndImgUrl(htmlString) {
  const $ = cheerio.load(htmlString);

  const textContent = $('body').text().trim();
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

async function getUserDetails(req, res) {
  const accessToken = req.body.accessToken || process.env.MEDIUM_INTEGRATION_TOKEN;

  if (!accessToken) {
    return res.status(400).json({ error: 'Missing access token' });
  }

  try {
    const response = await fetch('https://api.medium.com/v1/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Charset': 'utf-8',
      },
    });

    const data = await response.json();

    if (data.errors) {
      return res.status(400).json({ error: data.errors[0].message });
    }

    res.status(200).json({ success: true, user: data.data });
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
}

async function postToMedium(postData, accessToken) {
  const token = accessToken || process.env.MEDIUM_INTEGRATION_TOKEN;
  const { title, content, tags, canonicalUrl, publishStatus = 'draft' } = postData;

  if (!token) {
    throw new Error('No Medium access token provided');
  }

  try {
    // First get user ID
    const userResponse = await fetch('https://api.medium.com/v1/me', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    const userData = await userResponse.json();
    if (userData.errors) {
      throw new Error(userData.errors[0].message);
    }
    const userId = userData.data.id;

    // Create post
    const postResponse = await fetch(`https://api.medium.com/v1/users/${userId}/posts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        title,
        contentFormat: 'html',
        content,
        tags: tags || [],
        canonicalUrl,
        publishStatus,
      }),
    });

    const result = await postResponse.json();
    if (result.errors) {
      throw new Error(result.errors[0].message);
    }

    return result.data;
  } catch (error) {
    console.error('[Backend] Medium API error:', error);
    throw error;
  }
}

async function schedulePost(req, res) {
  console.log('schedulePost call');
  const { userId, title, content, tags, scheduledDate, notificationEmail } = req.body;

  const { urlSrcs } = extractTextAndImgUrl(content);

  if (!scheduledDate || !title || !content || !userId) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const newScheduledPost = new MediumPost({
    userId,
    title,
    content,
    tags,
    imageUrls: urlSrcs,
    scheduledDate,
    notificationEmail,
    platform: 'medium',
    status: 'scheduled',
  });

  newScheduledPost
    .save()
    .then((savedPost) => {
      console.log('scheduledPost saved:', savedPost);
      res.status(200).json({ success: true, post: savedPost });
    })
    .catch((error) => {
      console.error('[Backend] Database error: ', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    });
}

async function createPost(req, res) {
  console.log('createPost call');
  const { userId, accessToken, title, content, tags, notificationEmail } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const token = accessToken || process.env.MEDIUM_INTEGRATION_TOKEN;
  if (!token) {
    return res.status(400).json({ error: 'Missing access token' });
  }

  const { urlSrcs } = extractTextAndImgUrl(content);

  try {
    const mediumResponse = await postToMedium(
      {
        title,
        content,
        tags,
      },
      token,
    );

    const newPost = new MediumPost({
      userId,
      title,
      content,
      tags,
      imageUrls: urlSrcs,
      scheduledDate: new Date(),
      notificationEmail,
      platform: 'medium',
      status: 'posted',
    });

    await newPost.save();

    res.status(200).json({ success: true, post: mediumResponse });
  } catch (error) {
    console.error('[Backend] Network or other error: ', error);
    res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
}

async function getPosts(req, res) {
  console.log('getPosts call');
  try {
    const posts = await MediumPost.find({})
      .select(
        'title content tags scheduledDate status platform createdAt imageUrls notificationEmail',
      )
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, posts });
  } catch (error) {
    console.error('[Backend] Database error: ', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

async function deletePost(req, res) {
  console.log('deletePost call');
  const { _id } = req.body;

  if (!_id) {
    return res.status(400).json({ error: 'Missing required parameter: _id' });
  }

  try {
    const deletedPost = await MediumPost.findOneAndDelete({ _id });

    if (!deletedPost) {
      return res.status(404).json({ error: 'Post not found or already deleted' });
    }

    res.status(200).json({ success: true, message: 'Post deleted successfully' });
  } catch (error) {
    console.error('[Backend] Database error: ', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

async function updatePost(req, res) {
  console.log('updatePost call');
  const { _id, title, content, tags, scheduledDate } = req.body;

  if (!_id) {
    return res.status(400).json({ error: 'Missing required parameter: _id' });
  }

  const { urlSrcs } = extractTextAndImgUrl(content || '');

  try {
    const updateData = {
      title,
      content,
      tags,
      scheduledDate,
      imageUrls: urlSrcs,
    };

    // Remove undefined fields
    Object.keys(updateData).forEach(
      (key) => updateData[key] === undefined && delete updateData[key],
    );

    const updatedPost = await MediumPost.findOneAndUpdate({ _id }, updateData, { new: true });

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
  getUserDetails,
  createPost,
  schedulePost,
  postToMedium,
  getPosts,
  deletePost,
  updatePost,
};
